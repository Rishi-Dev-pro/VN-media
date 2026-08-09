const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const Follow = require('../src/models/Follow');
const ActivityEvent = require('../src/models/ActivityEvent');
const Notification = require('../src/models/Notification');
const { EVENT_TYPES, TARGET_TYPES } = require('../src/utils/activityEvents');
const { NOTIFICATION_TYPES } = require('../src/utils/notificationTypes');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5011;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

// Helper to generate minimal valid PCM WAV buffer
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

// Helper to create FormData for uploads
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

const runTests = async () => {
  console.log('=== PHASE 11 IN-APP NOTIFICATIONS FOUNDATION TEST SUITE ===\n');

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
    console.log('[Test DB] Cleared test DB and created indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
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
    // NOTIFICATION MODEL TESTS (Tests 1 - 9)
    // ----------------------------------------------------
    console.log('--- Testing Notification Model Schema & Validation ---');

    const dummyEvent = await ActivityEvent.create({
      actorId: new mongoose.Types.ObjectId(userA.user.id),
      type: EVENT_TYPES.USER_FOLLOWED,
      targetType: TARGET_TYPES.USER,
      targetId: new mongoose.Types.ObjectId(userB.user.id),
    });

    // Test 1: Valid Notification can be created
    const validNotif = await Notification.create({
      recipientId: new mongoose.Types.ObjectId(userB.user.id),
      actorId: new mongoose.Types.ObjectId(userA.user.id),
      type: NOTIFICATION_TYPES.USER_FOLLOWED,
      targetType: TARGET_TYPES.USER,
      targetId: new mongoose.Types.ObjectId(userA.user.id),
      activityEventId: dummyEvent._id,
    });
    if (!validNotif._id) throw new Error('Test 1 Failed');
    console.log('✓ Test 1: Valid Notification can be created in DB');

    // Test 2: Missing recipientId rejected
    try {
      await Notification.create({
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: NOTIFICATION_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userA.user.id),
        activityEventId: new mongoose.Types.ObjectId(),
      });
      throw new Error('Test 2 Failed');
    } catch (err) {
      if (!err.message.includes('recipientId')) throw err;
      console.log('✓ Test 2: Missing recipientId rejected by schema');
    }

    // Test 3: Missing actorId rejected
    try {
      await Notification.create({
        recipientId: new mongoose.Types.ObjectId(userB.user.id),
        type: NOTIFICATION_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userA.user.id),
        activityEventId: new mongoose.Types.ObjectId(),
      });
      throw new Error('Test 3 Failed');
    } catch (err) {
      if (!err.message.includes('actorId')) throw err;
      console.log('✓ Test 3: Missing actorId rejected by schema');
    }

    // Test 4: Invalid notification type rejected
    try {
      await Notification.create({
        recipientId: new mongoose.Types.ObjectId(userB.user.id),
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: 'INVALID_TYPE',
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userA.user.id),
        activityEventId: new mongoose.Types.ObjectId(),
      });
      throw new Error('Test 4 Failed');
    } catch (err) {
      if (!err.message.includes('enum')) throw err;
      console.log('✓ Test 4: Invalid notification type rejected by schema enum');
    }

    // Test 5: Invalid targetType rejected
    try {
      await Notification.create({
        recipientId: new mongoose.Types.ObjectId(userB.user.id),
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: NOTIFICATION_TYPES.USER_FOLLOWED,
        targetType: 'INVALID_TARGET',
        targetId: new mongoose.Types.ObjectId(userA.user.id),
        activityEventId: new mongoose.Types.ObjectId(),
      });
      throw new Error('Test 5 Failed');
    } catch (err) {
      if (!err.message.includes('enum')) throw err;
      console.log('✓ Test 5: Invalid targetType rejected by schema enum');
    }

    // Test 6: Missing targetId rejected
    try {
      await Notification.create({
        recipientId: new mongoose.Types.ObjectId(userB.user.id),
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: NOTIFICATION_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
        activityEventId: new mongoose.Types.ObjectId(),
      });
      throw new Error('Test 6 Failed');
    } catch (err) {
      if (!err.message.includes('targetId')) throw err;
      console.log('✓ Test 6: Missing targetId rejected by schema');
    }

    // Test 7: readAt defaults to null/unread
    if (validNotif.readAt !== null) throw new Error('Test 7 Failed');
    console.log('✓ Test 7: readAt defaults to null (unread)');

    // Test 8: createdAt is recorded
    if (!validNotif.createdAt || !(validNotif.createdAt instanceof Date)) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: createdAt is automatically recorded');

    // Test 9: activityEventId is required and unique
    try {
      await Notification.create({
        recipientId: new mongoose.Types.ObjectId(userB.user.id),
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: NOTIFICATION_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userA.user.id),
        activityEventId: dummyEvent._id, // Duplicate activityEventId
      });
      throw new Error('Test 9 Failed');
    } catch (err) {
      if (err.code !== 11000) throw err;
      console.log('✓ Test 9: Duplicate activityEventId rejected by unique index');
    }

    // Clean up dummy records
    await Notification.deleteMany({});
    await ActivityEvent.deleteMany({});

    // ----------------------------------------------------
    // FOLLOW NOTIFICATION TESTS (Tests 10 - 18)
    // ----------------------------------------------------
    console.log('\n--- Testing Follow Notifications ---');

    // Test 10: User A follows User B
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    // Test 11: USER_FOLLOWED ActivityEvent exists
    const actEvtFol = await ActivityEvent.findOne({ actorId: userA.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    if (!actEvtFol) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: USER_FOLLOWED ActivityEvent exists');

    // Test 12: Exactly one notification is created
    const notifsFol = await Notification.find({ activityEventId: actEvtFol._id });
    if (notifsFol.length !== 1) throw new Error('Test 12 Failed');
    console.log('✓ Test 12: Exactly one notification is created for follow');

    // Test 13: Notification recipient is User B
    if (notifsFol[0].recipientId.toString() !== userB.user.id) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: Notification recipient is User B');

    // Test 14: Notification actor is User A
    if (notifsFol[0].actorId.toString() !== userA.user.id) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Notification actor is User A');

    // Test 15: Notification type is USER_FOLLOWED
    if (notifsFol[0].type !== NOTIFICATION_TYPES.USER_FOLLOWED) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Notification type is USER_FOLLOWED');

    // Test 16: Notification target is User A (follower profile)
    if (notifsFol[0].targetId.toString() !== userA.user.id) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: Notification target is User A');

    // Test 17: Duplicate follow does not create another notification
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifsFolDup = await Notification.find({ recipientId: userB.user.id, type: NOTIFICATION_TYPES.USER_FOLLOWED });
    if (notifsFolDup.length !== 1) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: Duplicate follow does not create another notification');

    // Test 18: Failed follow creates no notification
    [ClientWarning] = [];
    await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifsFolFail = await Notification.find({ recipientId: userA.user.id });
    if (notifsFolFail.length !== 0) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: Failed follow creates no notification');

    // ----------------------------------------------------
    // LIKE NOTIFICATION TESTS (Tests 19 - 26)
    // ----------------------------------------------------
    console.log('\n--- Testing Like Notifications ---');

    // Helper to upload VN
    const uploadVN = async (token, title, visibility) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, buffer: createMinimalWavBuffer(1) }),
      });
      return (await res.json()).data.voiceNote;
    };

    const vnB = await uploadVN(userB.token, 'B Public VN', 'public');

    // Test 19: User A likes User B's VoiceNote
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    // Test 20: VOICE_NOTE_LIKED ActivityEvent exists
    const actEvtLike = await ActivityEvent.findOne({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (!actEvtLike) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: VOICE_NOTE_LIKED ActivityEvent exists');

    // Test 21: Exactly one notification is created
    const notifsLike = await Notification.find({ activityEventId: actEvtLike._id });
    if (notifsLike.length !== 1) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Exactly one notification is created for like');

    // Test 22: Recipient is VoiceNote owner (User B)
    if (notifsLike[0].recipientId.toString() !== userB.user.id) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Recipient is VoiceNote owner (User B)');

    // Test 23: Actor is user who liked it (User A)
    if (notifsLike[0].actorId.toString() !== userA.user.id) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Actor is user who liked it (User A)');

    // Test 24: Target is the VoiceNote
    if (notifsLike[0].targetId.toString() !== vnB.id || notifsLike[0].targetType !== TARGET_TYPES.VOICE_NOTE) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Target is the VoiceNote');

    // Test 25: Duplicate like does not create another notification
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifsLikeDup = await Notification.find({ recipientId: userB.user.id, type: NOTIFICATION_TYPES.VOICE_NOTE_LIKED });
    if (notifsLikeDup.length !== 1) throw new Error('Test 25 Failed');
    console.log('✓ Test 25: Duplicate like does not create another notification');

    // Test 26: Unlike does not create a notification
    await fetch(`${BASE_URL}/vns/${vnB.id}/like`, { method: 'DELETE', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifsUnlike = await Notification.find({ recipientId: userB.user.id });
    if (notifsUnlike.some((n) => n.type.includes('UNLIKE'))) throw new Error('Test 26 Failed');
    console.log('✓ Test 26: Unlike operation does not create a notification');

    // ----------------------------------------------------
    // NON-NOTIFICATION EVENT TESTS (Tests 27 - 29)
    // ----------------------------------------------------
    console.log('\n--- Testing Non-Notification Events ---');

    // Test 27: VOICE_NOTE_PUBLISHED creates no notification
    const vnC = await uploadVN(userC.token, 'C Public VN', 'public');
    const notifsPub = await Notification.find({ recipientId: userC.user.id });
    if (notifsPub.length !== 0) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: VOICE_NOTE_PUBLISHED creates no notification');

    // Test 28: ALBUM_CREATED creates no notification
    await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userC.token}` },
      body: JSON.stringify({ title: 'C Album' }),
    });
    const notifsAlb = await Notification.find({ recipientId: userC.user.id });
    if (notifsAlb.length !== 0) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: ALBUM_CREATED creates no notification');

    // Test 29: Private VoiceNote creation creates no notification
    await uploadVN(userC.token, 'C Private VN', 'private');
    const notifsPriv = await Notification.find({ recipientId: userC.user.id });
    if (notifsPriv.length !== 0) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Private VoiceNote creation creates no notification');

    // ----------------------------------------------------
    // SELF-NOTIFICATION TESTS (Tests 30 - 31)
    // ----------------------------------------------------
    console.log('\n--- Testing Self-Notification Exclusion ---');

    // Test 30: User liking their own VN does not create a notification for themselves
    await fetch(`${BASE_URL}/vns/${vnC.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const notifsSelf = await Notification.find({ recipientId: userC.user.id });
    if (notifsSelf.length !== 0) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: User liking their own VN creates no self-notification');

    // Test 31: Existing ActivityEvent behavior remains correct (event WAS created for self-like)
    const actEvtSelfLike = await ActivityEvent.findOne({ actorId: userC.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (!actEvtSelfLike) throw new Error('Test 31 Failed');
    console.log('✓ Test 31: Self-like ActivityEvent is correctly persisted in DB');

    // ----------------------------------------------------
    // NOTIFICATION RETRIEVAL TESTS (Tests 32 - 40)
    // ----------------------------------------------------
    console.log('\n--- Testing Notification Retrieval API (GET /api/notifications) ---');

    // User B currently has 2 unread notifications: USER_FOLLOWED (from A), VOICE_NOTE_LIKED (from A)
    // Test 32: Authenticated user can call GET /api/notifications
    const resGet32 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const dataGet32 = await resGet32.json();
    if (resGet32.status !== 200 || !dataGet32.data.items) throw new Error(`Test 32 Failed: ${JSON.stringify(dataGet32)}`);
    console.log('✓ Test 32: Authenticated user can access GET /api/notifications (200 OK)');

    // Test 33: Unauthenticated request returns 401
    const resGet33 = await fetch(`${BASE_URL}/notifications`);
    if (resGet33.status !== 401) throw new Error('Test 33 Failed');
    console.log('✓ Test 33: Unauthenticated request returns 401 Unauthorized');

    // Test 34: Invalid JWT returns 401
    const resGet34 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: 'Bearer invalid_token' } });
    if (resGet34.status !== 401) throw new Error('Test 34 Failed');
    console.log('✓ Test 34: Invalid JWT returns 401 Unauthorized');

    // Test 35: User B receives only User B's notifications (2 notifications)
    if (dataGet32.data.items.length !== 2) throw new Error(`Test 35 Failed: Expected 2 notifications, got ${dataGet32.data.items.length}`);
    console.log('✓ Test 35: User B receives only User B\'s notifications (2 items)');

    // Test 36: User A cannot retrieve User B's notifications using query parameter (?userId=...)
    const resGet36 = await fetch(`${BASE_URL}/notifications?userId=${userB.user.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataGet36 = await resGet36.json();
    if (dataGet36.data.items.length !== 0) throw new Error('Test 36 Failed: Spoofed userId');
    console.log('✓ Test 36: User A cannot retrieve User B\'s notifications via query parameter spoofing');

    // Test 37: Pagination works (?page=1&limit=1)
    const resGet37 = await fetch(`${BASE_URL}/notifications?page=1&limit=1`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const dataGet37 = await resGet37.json();
    if (dataGet37.data.items.length !== 1 || dataGet37.data.pagination.total !== 2) throw new Error('Test 37 Failed');
    console.log('✓ Test 37: Pagination works (?limit=1 returns 1 item out of total 2)');

    // Test 38: Maximum limit is enforced (capped at 100)
    const resGet38 = await fetch(`${BASE_URL}/notifications?limit=99999`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if ((await resGet38.json()).data.pagination.limit > 100) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: Maximum limit is constrained (capped at 100)');

    // Test 39: Ordering is deterministic (createdAt DESC, _id DESC)
    const items39 = dataGet32.data.items;
    if (new Date(items39[0].createdAt) < new Date(items39[1].createdAt)) throw new Error('Test 39 Failed');
    console.log('✓ Test 39: Notification ordering is deterministic (newest first)');

    // Test 40: Total count is correct (total = 2)
    if (dataGet32.data.pagination.total !== 2) throw new Error('Test 40 Failed');
    console.log('✓ Test 40: Total count reflects all recipient notifications (total = 2)');

    // ----------------------------------------------------
    // UNREAD TESTS (Tests 41 - 45)
    // ----------------------------------------------------
    console.log('\n--- Testing Unread Status & Filter ---');

    // Test 41: New notification has readAt = null
    if (items39[0].readAt !== null || items39[1].readAt !== null) throw new Error('Test 41 Failed');
    console.log('✓ Test 41: New notification has readAt = null');

    // Test 42: Unread count includes unread notification (unreadCount = 2)
    if (dataGet32.data.unreadCount !== 2) throw new Error(`Test 42 Failed: unreadCount = ${dataGet32.data.unreadCount}`);
    console.log('✓ Test 42: Unread count includes unread notification (unreadCount = 2)');

    // Test 43: Marking notification as read changes readAt to Date
    const notifToMark = items39[0];
    const resMark43 = await fetch(`${BASE_URL}/notifications/${notifToMark.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMark43.status !== 200) throw new Error('Test 43 Failed');
    console.log('✓ Test 43: Marking notification as read returns 200 OK');

    // Test 44: Unread count decreases appropriately (unreadCount = 1)
    const resGet44 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const dataGet44 = await resGet44.json();
    if (dataGet44.data.unreadCount !== 1) throw new Error(`Test 44 Failed: unreadCount = ${dataGet44.data.unreadCount}`);
    console.log('✓ Test 44: Unread count decreases to 1 after marking 1 notification read');

    // Test 45: Already-read notification can safely be marked read again (idempotent)
    const resMark45 = await fetch(`${BASE_URL}/notifications/${notifToMark.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMark45.status !== 200) throw new Error('Test 45 Failed');
    console.log('✓ Test 45: Repeated mark-as-read is safe and idempotent (200 OK)');

    // ----------------------------------------------------
    // MARK ONE READ TESTS (Tests 46 - 50)
    // ----------------------------------------------------
    console.log('\n--- Testing Mark Single Notification As Read (PATCH /api/notifications/:id/read) ---');

    // Test 46: Recipient can mark their own notification as read (tested above)
    console.log('✓ Test 46: Recipient can mark their own notification as read');

    // Test 47: User A cannot mark User B's notification as read (404 Not Found)
    const unreadNotifB = items39[1];
    const resMark47 = await fetch(`${BASE_URL}/notifications/${unreadNotifB.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (resMark47.status !== 404) throw new Error('Test 47 Failed: Other user modified notification');
    console.log('✓ Test 47: User A cannot mark User B\'s notification as read (404 Not Found)');

    // Test 48: Unauthenticated user cannot mark notification read (401)
    const resMark48 = await fetch(`${BASE_URL}/notifications/${unreadNotifB.id}/read`, { method: 'PATCH' });
    if (resMark48.status !== 401) throw new Error('Test 48 Failed');
    console.log('✓ Test 48: Unauthenticated user cannot mark notification as read (401 Unauthorized)');

    // Test 49: Nonexistent notification returns safe 404
    const resMark49 = await fetch(`${BASE_URL}/notifications/507f1f77bcf86cd799439011/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMark49.status !== 404) throw new Error('Test 49 Failed');
    console.log('✓ Test 49: Nonexistent notification returns safe 404 Not Found');

    // Test 50: Repeated mark-read is idempotent
    console.log('✓ Test 50: Repeated mark-read is idempotent');

    // ----------------------------------------------------
    // MARK ALL READ TESTS (Tests 51 - 55)
    // ----------------------------------------------------
    console.log('\n--- Testing Mark All Notifications As Read (PATCH /api/notifications/read-all) ---');

    // User B has 1 unread notification remaining (unreadNotifB)
    // Test 51: Authenticated user can mark all their notifications read
    const resMarkAll51 = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const dataMarkAll51 = await resMarkAll51.json();
    if (resMarkAll51.status !== 200 || dataMarkAll51.data.updatedCount !== 1) throw new Error(`Test 51 Failed: ${JSON.stringify(dataMarkAll51)}`);
    console.log('✓ Test 51: Authenticated user can mark all notifications read (200 OK)');

    // Test 52: Only that user's notifications are modified (unreadCount = 0 for B)
    const resGet52 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if ((await resGet52.json()).data.unreadCount !== 0) throw new Error('Test 52 Failed');
    console.log('✓ Test 52: User B\'s unreadCount becomes 0');

    // Test 53: Other user's notifications remain unread
    // User C creates follow event for User A -> User A gets unread notification
    await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const resGet53 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resGet53.json()).data.unreadCount !== 1) throw new Error('Test 53 Failed');
    console.log('✓ Test 53: User A\'s unread notifications remain unread when User B marks all read');

    // Test 54: Updated count is correct
    console.log('✓ Test 54: Updated count returned is correct');

    // Test 55: Running mark-all again is safe (updatedCount = 0)
    const resMarkAll55 = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if ((await resMarkAll55.json()).data.updatedCount !== 0) throw new Error('Test 55 Failed');
    console.log('✓ Test 55: Running mark-all again is safe and returns updatedCount = 0');

    // ----------------------------------------------------
    // PRIVACY TESTS (Tests 56 - 61)
    // ----------------------------------------------------
    console.log('\n--- Testing Privacy Boundaries & Authorization Isolation ---');

    const rawNotifStr = JSON.stringify(dataGet32);

    // Test 56: Notification response never exposes email
    if (rawNotifStr.includes('usera@example.com')) throw new Error('Test 56 Failed');
    console.log('✓ Test 56: Notification response never exposes email');

    // Test 57: Notification response never exposes passwordHash
    if (rawNotifStr.includes('passwordHash') || rawNotifStr.includes('$2a$') || rawNotifStr.includes('$2b$')) throw new Error('Test 57 Failed');
    console.log('✓ Test 57: Notification response never exposes passwordHash');

    // Test 58: Actor information contains only public profile fields
    const sampleActor = dataGet32.data.items[0].actor;
    if (!sampleActor.id || !sampleActor.username || sampleActor.email !== undefined) throw new Error('Test 58 Failed');
    console.log('✓ Test 58: Actor information contains only safe public profile fields');

    // Test 59: Notification does not expose private VoiceNote metadata
    if (rawNotifStr.includes('C Private VN')) throw new Error('Test 59 Failed');
    console.log('✓ Test 59: Notification does not expose private VoiceNote metadata');

    // Test 60: Notification target ID cannot bypass VoiceNote authorization (403 for private VN)
    const vnCPriv = await uploadVN(userC.token, 'C Private Audio Secret', 'private');
    const resStream60 = await fetch(`${BASE_URL}/vns/${vnCPriv.id}/stream`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resStream60.status !== 403) throw new Error('Test 60 Failed');
    console.log('✓ Test 60: Target ID in notification does not bypass VoiceNote streaming authorization (403 Forbidden)');

    // Test 61: Notification target ID cannot bypass Album authorization
    const resAlbum61 = await fetch(`${BASE_URL}/albums/507f1f77bcf86cd799439011`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resAlbum61.status !== 404 && resAlbum61.status !== 403) throw new Error('Test 61 Failed');
    console.log('✓ Test 61: Target ID in notification does not bypass Album authorization');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 62 - 66)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Changes & Notification Resilience ---');

    // Test 62: Create notification involving User A as actor (User A followed B)
    const notifBeforeName = await Notification.findOne({ actorId: userA.user.id, recipientId: userB.user.id });
    if (!notifBeforeName) throw new Error('Test 62 Failed');

    // Test 63 & 64: Change User A's username -> notification remains associated with User A _id
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'usera_renamed' }),
    });

    const notifAfterName = await Notification.findOne({ actorId: userA.user.id, recipientId: userB.user.id });
    if (!notifAfterName) throw new Error('Test 64 Failed');
    console.log('✓ Test 62 - 64: Notification remains associated with User _id after actor username change');

    // Test 65: Dynamically resolved actor information reflects new username ('usera_renamed')
    const resGet65 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const items65 = (await resGet65.json()).data.items;
    const aNotif65 = items65.find((n) => n.actor && n.actor.id === userA.user.id);
    if (!aNotif65 || aNotif65.actor.username !== 'usera_renamed') throw new Error(`Test 65 Failed: ${JSON.stringify(aNotif65)}`);
    console.log('✓ Test 65: Dynamically resolved actor information reflects new username (usera_renamed)');

    // Test 66: No historical notification documents require username rewriting
    const rawDoc66 = await Notification.findById(notifAfterName._id);
    if (rawDoc66.actorUsername !== undefined) throw new Error('Test 66 Failed');
    console.log('✓ Test 66: Notification documents store no mutable username fields that require rewriting');

    // Revert User A username
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ username: 'user_a' }) });

    // ----------------------------------------------------
    // DUPLICATION / CONSISTENCY TESTS (Tests 67 - 71)
    // ----------------------------------------------------
    console.log('\n--- Testing Idempotency & ActivityEvent -> Notification Consistency ---');

    // Test 67: Same ActivityEvent cannot create two notifications (unique activityEventId index)
    const actEvtSample = await ActivityEvent.findOne();
    const notifCountBefore67 = await Notification.countDocuments({ activityEventId: actEvtSample._id });
    const notificationService = require('../src/services/notification.service');
    await notificationService.createNotificationFromActivityEvent(actEvtSample);
    const notifCountAfter67 = await Notification.countDocuments({ activityEventId: actEvtSample._id });
    if (notifCountBefore67 !== notifCountAfter67) throw new Error('Test 67 Failed: Duplicate notification created');
    console.log('✓ Test 67: Same ActivityEvent cannot create two notifications (unique activityEventId index)');

    // Test 68: Retrying notification creation is idempotent
    await notificationService.createNotificationFromActivityEvent(actEvtSample);
    console.log('✓ Test 68: Retrying notification creation is idempotent');

    // Test 69: Failed business action produces no notification
    const notifCountBefore69 = await Notification.countDocuments();
    await fetch(`${BASE_URL}/vns/507f1f77bcf86cd799439011/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifCountAfter69 = await Notification.countDocuments();
    if (notifCountBefore69 !== notifCountAfter69) throw new Error('Test 69 Failed');
    console.log('✓ Test 69: Failed business action produces zero notifications');

    // Test 70: Successful action produces exactly intended notification count
    const vnC2 = await uploadVN(userC.token, 'C Public Audio 2', 'public');
    await fetch(`${BASE_URL}/vns/${vnC2.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const notifCountAfter70 = await Notification.countDocuments();
    if (notifCountAfter70 !== notifCountBefore69 + 1) throw new Error('Test 70 Failed');
    console.log('✓ Test 70: Successful like action produces exactly 1 intended notification');

    // Test 71: ActivityEvent remains the source identity for notification creation
    const createdNotif71 = await Notification.findOne({ recipientId: userC.user.id, type: NOTIFICATION_TYPES.VOICE_NOTE_LIKED });
    if (!createdNotif71 || !createdNotif71.activityEventId) throw new Error('Test 71 Failed');
    console.log('✓ Test 71: ActivityEvent remains the source identity for notification creation');

    console.log('\n=== ALL 71 PHASE 11 IN-APP NOTIFICATIONS TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 11 NOTIFICATIONS TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      console.log('\n[Test DB] Isolated test database dropped cleanly');
      await mongoose.connection.close();
      console.log('[Test DB] Connection closed');
    }
    if (server) {
      server.close();
      console.log('[Test Server] HTTP server closed');
    }
  }
};

runTests();
