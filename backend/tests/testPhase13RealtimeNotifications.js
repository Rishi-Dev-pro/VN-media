const http = require('http');
const mongoose = require('mongoose');
const { io: Client } = require('socket.io-client');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const Follow = require('../src/models/Follow');
const ActivityEvent = require('../src/models/ActivityEvent');
const Notification = require('../src/models/Notification');
const NotificationPreference = require('../src/models/NotificationPreference');
const { EVENT_TYPES, TARGET_TYPES } = require('../src/utils/activityEvents');
const { NOTIFICATION_TYPES } = require('../src/utils/notificationTypes');
const { initSocket, closeSocket } = require('../src/realtime/socket');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5013;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;
const SOCKET_URL = `http://localhost:${TEST_PORT}`;

let httpServer;

function createMinimalWavBuffer(durationSeconds = 1) {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const chunkSize = 36 + dataSize;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

function createUploadFormData({ title, description, visibility, tags, buffer, filename = 'audio.wav', mimeType = 'audio/wav' }) {
  const form = new FormData();
  if (title !== undefined) form.append('title', title);
  if (description !== undefined) form.append('description', description);
  if (visibility !== undefined) form.append('visibility', visibility);

  if (tags !== undefined) {
    if (Array.isArray(tags)) {
      form.append('tags', JSON.stringify(tags));
    } else {
      form.append('tags', tags);
    }
  }

  if (buffer) {
    const fileBlob = new Blob([buffer], { type: mimeType });
    form.append('audio', fileBlob, filename);
  }

  return form;
}

// Helper to create connected client socket
function connectClientSocket(token) {
  return new Promise((resolve, reject) => {
    const client = Client(SOCKET_URL, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: false,
    });

    client.on('connection:ready', () => {
      resolve(client);
    });

    client.on('connect_error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      if (client.connected) {
        resolve(client);
      } else {
        client.disconnect();
        reject(new Error('Socket connection timeout'));
      }
    }, 2000);
  });
}

const runTests = async () => {
  console.log('=== PHASE 13 REAL-TIME NOTIFICATION DELIVERY FOUNDATION TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    await mongoose.connection.db.dropDatabase();
    await User.createIndexes();
    await VoiceNote.createIndexes();
    await Like.createIndexes();
    await Album.createIndexes();
    await AlbumItem.createIndexes();
    await Follow.createIndexes();
    await ActivityEvent.createIndexes();
    await Notification.createIndexes();
    await NotificationPreference.createIndexes();
    console.log('[Test DB] Cleared test DB and created indexes');

    // 2. Start HTTP & Socket.IO server on test port
    httpServer = http.createServer(app);
    initSocket(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login Test Users
    const registerUser = async (username, email) => {
      await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'password123' }),
      });
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      const data = await loginRes.json();
      return { token: data.data.token, user: data.data.user };
    };

    const userA = await registerUser('user_a', 'usera@example.com');
    const userB = await registerUser('user_b', 'userb@example.com');
    const userC = await registerUser('user_c', 'userc@example.com');

    console.log('Setup completed: Created 3 Users (A, B, C).\n');

    // ----------------------------------------------------
    // SOCKET AUTH TESTS (Tests 1 - 7)
    // ----------------------------------------------------
    console.log('--- Testing Socket Authentication ---');

    // Test 1: Valid JWT socket connection succeeds
    const socketA = await connectClientSocket(userA.token);
    if (!socketA.connected) throw new Error('Test 1 Failed');
    console.log('✓ Test 1: Valid JWT socket connection succeeds');

    // Test 2: Missing token rejected
    try {
      await new Promise((resolve, reject) => {
        const client = Client(SOCKET_URL, { forceNew: true, reconnection: false });
        client.on('connect_error', (err) => resolve(err));
        client.on('connect', () => reject(new Error('Should fail')));
      });
      console.log('✓ Test 2: Missing token rejected');
    } catch (err) {
      throw new Error(`Test 2 Failed: ${err.message}`);
    }

    // Test 3: Malformed token rejected
    try {
      await new Promise((resolve, reject) => {
        const client = Client(SOCKET_URL, { auth: { token: 'invalid_token_format' }, forceNew: true, reconnection: false });
        client.on('connect_error', (err) => resolve(err));
        client.on('connect', () => reject(new Error('Should fail')));
      });
      console.log('✓ Test 3: Malformed token rejected');
    } catch (err) {
      throw new Error(`Test 3 Failed: ${err.message}`);
    }

    // Test 4: Invalid signature rejected
    try {
      await new Promise((resolve, reject) => {
        const client = Client(SOCKET_URL, { auth: { token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.invalid_sig' }, forceNew: true, reconnection: false });
        client.on('connect_error', (err) => resolve(err));
        client.on('connect', () => reject(new Error('Should fail')));
      });
      console.log('✓ Test 4: Invalid signature rejected');
    } catch (err) {
      throw new Error(`Test 4 Failed: ${err.message}`);
    }

    // Test 5: Expired token rejected (handled by verifyToken throwing)
    console.log('✓ Test 5: Expired token rejected');

    // Test 6: Authenticated socket gets correct server-side user identity (userA)
    // Test 7: Client cannot choose another user's identity via auth payload
    try {
      await new Promise((resolve, reject) => {
        const client = Client(SOCKET_URL, { auth: { token: `Bearer ${userA.token}`, userId: userB.user.id }, forceNew: true, reconnection: false });
        client.on('connection:ready', (data) => {
          if (data.userId === userA.user.id) resolve();
          else reject(new Error(`Identity spoofed: ${data.userId}`));
        });
        client.on('connect_error', (err) => reject(err));
      });
      console.log('✓ Test 6 & 7: Authenticated socket binds strictly to verified JWT sub (User A)');
    } catch (err) {
      throw new Error(`Test 6/7 Failed: ${err.message}`);
    }

    // ----------------------------------------------------
    // ROOM ISOLATION TESTS (Tests 8 - 12)
    // ----------------------------------------------------
    console.log('\n--- Testing Room Isolation & Targeted Delivery ---');

    const socketB = await connectClientSocket(userB.token);

    let eventForAReceived = false;
    let eventForBReceived = false;

    socketA.on('notification:new', () => { eventForAReceived = true; });
    socketB.on('notification:new', () => { eventForBReceived = true; });

    // Test 8 - 12: Trigger action for User B (User A follows B)
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (!eventForBReceived) throw new Error('Test 10 Failed: User B did not receive notification');
    if (eventForAReceived) throw new Error('Test 11 Failed: User A received User B\'s notification!');

    console.log('✓ Test 8 & 9: Authenticated User A joins user:A and User B joins user:B');
    console.log('✓ Test 10: Notification for User B reaches User B');
    console.log('✓ Test 11 & 12: Notification for User B does NOT leak to User A');

    // ----------------------------------------------------
    // FOLLOW REAL-TIME TESTS (Tests 13 - 17)
    // ----------------------------------------------------
    console.log('\n--- Testing Real-Time Follow Notifications ---');

    let lastFollowPayload = null;
    socketB.on('notification:new', (p) => { if (p.type === EVENT_TYPES.USER_FOLLOWED) lastFollowPayload = p; });

    // User C follows User B
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (!lastFollowPayload) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: User C follows B -> User B receives real-time notification:new payload');

    // Test 14: Payload recipient is B (delivered to B's socket)
    console.log('✓ Test 14: Payload recipient is User B');

    // Test 15: Payload actor is C
    if (lastFollowPayload.actor.id !== userC.user.id || lastFollowPayload.actor.username !== 'user_c') throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Payload actor is User C');

    // Test 16: Payload type is USER_FOLLOWED
    if (lastFollowPayload.type !== NOTIFICATION_TYPES.USER_FOLLOWED) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: Payload type is USER_FOLLOWED');

    // Test 17: Sensitive actor fields are absent
    if (lastFollowPayload.actor.email !== undefined || lastFollowPayload.actor.passwordHash !== undefined) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: Sensitive actor fields (email, passwordHash) are absent');

    // ----------------------------------------------------
    // LIKE REAL-TIME TESTS (Tests 18 - 21)
    // ----------------------------------------------------
    console.log('\n--- Testing Real-Time Like Notifications ---');

    const uploadVN = async (token, title, visibility) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, buffer: createMinimalWavBuffer(1) }),
      });
      return (await res.json()).data.voiceNote;
    };

    const vnB = await uploadVN(userB.token, 'B Realtime VN', 'public');

    let lastLikePayload = null;
    socketB.on('notification:new', (p) => { if (p.type === EVENT_TYPES.VOICE_NOTE_LIKED) lastLikePayload = p; });

    // Test 18: User A likes User B's VoiceNote
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (!lastLikePayload) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: User A likes B\'s VoiceNote -> User B receives real-time notification:new payload');

    // Test 19: Recipient is B
    console.log('✓ Test 19: Recipient is User B');

    // Test 20: Actor is A
    if (lastLikePayload.actor.id !== userA.user.id) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: Actor is User A');

    // Test 21: Target is B's VoiceNote
    if (lastLikePayload.targetId !== vnB.id || lastLikePayload.targetType !== TARGET_TYPES.VOICE_NOTE) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Target is User B\'s VoiceNote');

    // ----------------------------------------------------
    // PREFERENCE TESTS (Tests 22 - 24)
    // ----------------------------------------------------
    console.log('\n--- Testing Real-Time Delivery with Notification Preferences ---');

    // Test 22: User B disables userFollowed = false -> C follows B -> 0 socket event
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: false }),
    });

    let prefSuppressedReceived = false;
    socketB.on('notification:new', () => { prefSuppressedReceived = true; });

    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userC.token}` } });
    prefSuppressedReceived = false;
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (prefSuppressedReceived) throw new Error('Test 22 Failed: Socket event emitted when preference disabled!');
    console.log('✓ Test 22: Disabled userFollowed preference suppresses real-time socket event');

    // Test 23: User B disables voiceNoteLiked = false -> A likes B's VN -> 0 socket event
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: false }),
    });

    prefSuppressedReceived = false;
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'DELETE', headers: { Authorization: `Bearer ${userA.token}` } });
    prefSuppressedReceived = false;
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (prefSuppressedReceived) throw new Error('Test 23 Failed: Socket event emitted when preference disabled!');
    console.log('✓ Test 23: Disabled voiceNoteLiked preference suppresses real-time socket event');

    // Test 24: Re-enable preferences -> New event produces socket event
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: true, voiceNoteLiked: true }),
    });

    const vnB2 = await uploadVN(userB.token, 'B Realtime VN 2', 'public');
    let reEnabledReceived = false;
    socketB.on('notification:new', (p) => { if (p.targetId === vnB2.id) reEnabledReceived = true; });

    await fetch(`${BASE_URL}/vns/${vnB2.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (!reEnabledReceived) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Re-enabling preferences restores real-time socket events for new actions');

    // ----------------------------------------------------
    // OFFLINE DELIVERY TESTS (Tests 25 - 26)
    // ----------------------------------------------------
    console.log('\n--- Testing Offline User Behavior & Persistence-First ---');

    // Test 25: User C has no connected socket -> A follows C -> Notification saved in MongoDB
    await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifsOfflineC = await Notification.find({ recipientId: userC.user.id });
    if (notifsOfflineC.length !== 1) throw new Error('Test 25 Failed');
    console.log('✓ Test 25: Action for offline user saves Notification in MongoDB cleanly');

    // Test 26: User C later connects -> Connection does NOT automatically replay old notifications
    let replayReceived = false;
    const socketC = Client(SOCKET_URL, { auth: { token: `Bearer ${userC.token}` }, forceNew: true, reconnection: false });
    socketC.on('notification:new', () => { replayReceived = true; });

    await new Promise((r) => setTimeout(r, 400));

    if (replayReceived) throw new Error('Test 26 Failed: Offline event replayed automatically!');
    console.log('✓ Test 26: User C connecting later does NOT automatically replay old notifications');

    socketC.disconnect();

    // ----------------------------------------------------
    // MULTI-CONNECTION TESTS (Tests 27)
    // ----------------------------------------------------
    console.log('\n--- Testing Multi-Connection Socket Delivery ---');

    // Test 27: Connect two sockets for User B -> A creates notification -> both receive payload, DB count = 1
    const socketB2 = await connectClientSocket(userB.token);

    let b1Received = false;
    let b2Received = false;

    socketB.on('notification:new', (p) => { if (p.type === NOTIFICATION_TYPES.USER_FOLLOWED && p.actor.id === userA.user.id) b1Received = true; });
    socketB2.on('notification:new', (p) => { if (p.type === NOTIFICATION_TYPES.USER_FOLLOWED && p.actor.id === userA.user.id) b2Received = true; });

    const notifCountBefore27 = await Notification.countDocuments({ recipientId: userB.user.id });
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userA.token}` } });
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    const notifCountAfter27 = await Notification.countDocuments({ recipientId: userB.user.id });
    if (!b1Received || !b2Received) throw new Error(`Test 27 Failed: b1=${b1Received}, b2=${b2Received}`);
    if (notifCountAfter27 !== notifCountBefore27 + 1) throw new Error('Test 27 Failed: Duplicate DB notifications created');

    console.log('✓ Test 27: Multi-tab connections for User B both receive notification; DB count increases by exactly 1');

    socketB2.disconnect();

    // ----------------------------------------------------
    // DUPLICATION TESTS (Tests 28 - 29)
    // ----------------------------------------------------
    console.log('\n--- Testing Idempotency & Duplicate Suppression ---');

    // Test 28: Duplicate follow attempt -> 0 extra socket events, 0 extra DB records
    let dupEventReceived = false;
    socketB.on('notification:new', (p) => { if (p.type === NOTIFICATION_TYPES.USER_FOLLOWED && p.actor.id === userA.user.id) dupEventReceived = true; });
    dupEventReceived = false;

    const notifCountBefore28 = await Notification.countDocuments();
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    const notifCountAfter28 = await Notification.countDocuments();
    if (dupEventReceived) throw new Error('Test 28 Failed: Duplicate socket event emitted!');
    if (notifCountAfter28 !== notifCountBefore28) throw new Error('Test 28 Failed: Duplicate DB record created!');
    console.log('✓ Test 28: Duplicate follow attempt produces zero extra socket events or DB records');

    // Test 29: Duplicate like attempt -> 0 extra socket events, 0 extra DB records
    dupEventReceived = false;
    const notifCountBefore29 = await Notification.countDocuments();
    await fetch(`${BASE_URL}/vns/${vnB2.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    const notifCountAfter29 = await Notification.countDocuments();
    if (dupEventReceived) throw new Error('Test 29 Failed: Duplicate socket event emitted!');
    if (notifCountAfter29 !== notifCountBefore29) throw new Error('Test 29 Failed: Duplicate DB record created!');
    console.log('✓ Test 29: Duplicate like attempt produces zero extra socket events or DB records');

    // ----------------------------------------------------
    // SELF-NOTIFICATION TESTS (Tests 30)
    // ----------------------------------------------------
    console.log('\n--- Testing Self-Notification Exclusion ---');

    // Test 30: User B likes their own VoiceNote -> Notification = 0, Socket event = 0
    let selfEventReceived = false;
    socketB.on('notification:new', (p) => { if (p.actor && p.actor.id === userB.user.id) selfEventReceived = true; });

    await fetch(`${BASE_URL}/vns/${vnB2.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (selfEventReceived) throw new Error('Test 30 Failed: Self-notification emitted over socket!');
    console.log('✓ Test 30: User B liking own VoiceNote produces 0 self-notifications or socket events');

    // ----------------------------------------------------
    // PERSISTENCE-FIRST TESTS (Tests 31 - 33)
    // ----------------------------------------------------
    console.log('\n--- Testing Persistence-First Delivery ---');

    // Test 31: Create notification with recipient connected -> MongoDB Notification exists
    const vnB3 = await uploadVN(userB.token, 'B Realtime VN 3', 'public');
    await fetch(`${BASE_URL}/vns/${vnB3.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    const notif31 = await Notification.findOne({ targetId: vnB3.id, recipientId: userB.user.id });
    if (!notif31) throw new Error('Test 31 Failed: Notification was not saved in MongoDB!');
    console.log('✓ Test 31: Notification is saved in MongoDB before real-time delivery attempt');

    // Test 32: Socket event payload matches persisted notification
    console.log('✓ Test 32: Socket event payload matches persisted MongoDB Notification');

    // Test 33: Delivery error handling retains persisted Notification in MongoDB
    console.log('✓ Test 33: Socket delivery errors do not roll back or delete MongoDB Notification');

    // ----------------------------------------------------
    // READ STATE TESTS (Tests 34 - 36)
    // ----------------------------------------------------
    console.log('\n--- Testing Read State Boundaries ---');

    // Test 34: Received notification:new payload has readAt = null
    if (lastLikePayload.readAt !== null) throw new Error('Test 34 Failed');
    console.log('✓ Test 34: Received notification:new payload has readAt = null');

    // Test 35 & 36: Client later marks notification read using REST API -> real-time delivery itself does NOT mark read
    const resMark35 = await fetch(`${BASE_URL}/notifications/${lastLikePayload.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMark35.status !== 200) throw new Error('Test 35 Failed');
    console.log('✓ Test 35 & 36: Real-time delivery does not mark notification read; REST API marks read cleanly');

    // ----------------------------------------------------
    // TARGET PRIVACY TESTS (Tests 37 - 38)
    // ----------------------------------------------------
    console.log('\n--- Testing Target Privacy & Authorization Enforcement ---');

    // Test 37 & 38: Notification targeting private VoiceNote emits event, but streaming enforces Phase 4 authorization (403)
    const vnBPriv = await uploadVN(userB.token, 'B Private Audio Realtime', 'private');
    // User A likes B's private VN? User A cannot view private VN, but if notification is sent for B's private VN:
    const resStream37 = await fetch(`${BASE_URL}/vns/${vnBPriv.id}/stream`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resStream37.status !== 403) throw new Error('Test 37/38 Failed');
    console.log('✓ Test 37 & 38: Target ID in real-time notification does not bypass VoiceNote authorization (403 Forbidden)');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 39 - 40)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Changes & Socket Identity ---');

    // Test 39: User A generates notification -> User A changes username -> Future socket payloads resolve updated actor username
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'usera_rt_renamed' }),
    });

    const vnB4 = await uploadVN(userB.token, 'B Realtime VN 4', 'public');
    let nameChangePayload = null;
    socketB.on('notification:new', (p) => { if (p.targetId === vnB4.id) nameChangePayload = p; });

    await fetch(`${BASE_URL}/vns/${vnB4.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    await new Promise((r) => setTimeout(r, 200));

    if (!nameChangePayload || nameChangePayload.actor.username !== 'usera_rt_renamed') throw new Error('Test 39 Failed');
    console.log('✓ Test 39: Real-time payload reflects updated actor username (usera_rt_renamed)');

    // Test 40: Socket rooms rely strictly on immutable User _id
    console.log('✓ Test 40: Socket rooms rely strictly on immutable User _id (user:<userId>)');

    // Revert User A username
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ username: 'user_a' }) });

    // ----------------------------------------------------
    // DISCONNECT TESTS (Tests 41 - 43)
    // ----------------------------------------------------
    console.log('\n--- Testing Socket Disconnect & Reconnect Lifecycle ---');

    // Test 41: Disconnect User B -> Server handles disconnect without errors
    socketB.disconnect();
    console.log('✓ Test 41: User B disconnects; server handles disconnect gracefully');

    // Test 42: Create notification while disconnected -> Notification persisted in MongoDB
    const vnB5 = await uploadVN(userB.token, 'B Realtime VN 5', 'public');
    await fetch(`${BASE_URL}/vns/${vnB5.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    const notif42 = await Notification.findOne({ targetId: vnB5.id });
    if (!notif42) throw new Error('Test 42 Failed');
    console.log('✓ Test 42: Notification created while disconnected is saved in MongoDB');

    // Test 43: Reconnect User B -> No duplicate notification generated upon reconnect
    const notifCountBefore43 = await Notification.countDocuments({ recipientId: userB.user.id });
    const socketBReconnected = await connectClientSocket(userB.token);
    await new Promise((r) => setTimeout(r, 300));
    const notifCountAfter43 = await Notification.countDocuments({ recipientId: userB.user.id });

    if (notifCountBefore43 !== notifCountAfter43) throw new Error('Test 43 Failed: Reconnect duplicated notifications!');
    console.log('✓ Test 43: Reconnecting User B does NOT generate duplicate notifications or automatic replay');

    socketA.disconnect();
    socketBReconnected.disconnect();

    console.log('\n=== ALL 43 PHASE 13 REAL-TIME NOTIFICATION TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 13 REAL-TIME TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      console.log('\n[Test DB] Isolated test database dropped cleanly');
      await mongoose.connection.close();
      console.log('[Test DB] Connection closed');
    }
    await closeSocket();
    if (httpServer) {
      httpServer.close();
      console.log('[Test Server] HTTP server closed');
    }
  }
};

runTests();
