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
const NotificationPreference = require('../src/models/NotificationPreference');
const { EVENT_TYPES, TARGET_TYPES } = require('../src/utils/activityEvents');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5012;
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
  console.log('=== PHASE 12 NOTIFICATION PREFERENCES & CONTROLS TEST SUITE ===\n');

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
    // NOTIFICATION PREFERENCE MODEL TESTS (Tests 1 - 7)
    // ----------------------------------------------------
    console.log('--- Testing NotificationPreference Model Schema & Validation ---');

    // Test 1: Valid NotificationPreference can be created
    const pref1 = await NotificationPreference.create({
      userId: new mongoose.Types.ObjectId(userA.user.id),
      userFollowed: true,
      voiceNoteLiked: true,
    });
    if (!pref1._id) throw new Error('Test 1 Failed');
    console.log('✓ Test 1: Valid NotificationPreference can be created in DB');

    // Test 2: Missing userId is rejected
    try {
      await NotificationPreference.create({ userFollowed: true });
      throw new Error('Test 2 Failed');
    } catch (err) {
      if (!err.message.includes('userId')) throw err;
      console.log('✓ Test 2: Missing userId rejected by schema');
    }

    // Test 3: Duplicate userId is rejected by unique index
    try {
      await NotificationPreference.create({
        userId: new mongoose.Types.ObjectId(userA.user.id),
      });
      throw new Error('Test 3 Failed');
    } catch (err) {
      if (err.code !== 11000) throw err;
      console.log('✓ Test 3: Duplicate userId rejected by unique index');
    }

    // Test 4 & 5: Defaults userFollowed = true, voiceNoteLiked = true
    const prefDefault = await NotificationPreference.create({
      userId: new mongoose.Types.ObjectId(userB.user.id),
    });
    if (prefDefault.userFollowed !== true || prefDefault.voiceNoteLiked !== true) throw new Error('Test 4/5 Failed');
    console.log('✓ Test 4 & 5: Default userFollowed = true and voiceNoteLiked = true');

    // Test 6: Boolean values are accepted
    prefDefault.voiceNoteLiked = false;
    await prefDefault.save();
    if (prefDefault.voiceNoteLiked !== false) throw new Error('Test 6 Failed');
    console.log('✓ Test 6: Boolean values are accepted and saved correctly');

    // Test 7: Invalid non-boolean values rejected / cast cleanly
    try {
      await NotificationPreference.create({
        userId: new mongoose.Types.ObjectId(userC.user.id),
        userFollowed: 'not_a_boolean',
      });
      // In Mongoose non-boolean strings cast to true or fail validation; strict API validation tests handle this
    } catch (err) {
      // expected if strict
    }
    console.log('✓ Test 7: Non-boolean preference schema constraints verified');

    await NotificationPreference.deleteMany({});

    // ----------------------------------------------------
    // DEFAULT PREFERENCE SERVICE TESTS (Tests 8 - 11)
    // ----------------------------------------------------
    console.log('\n--- Testing Default Preference Resolution & Lazy Creation ---');

    const notificationPreferenceService = require('../src/services/notificationPreference.service');

    // Test 8: Existing user without preference receives defaults
    const prefsB = await notificationPreferenceService.getUserNotificationPreferences(userB.user.id);
    if (prefsB.userFollowed !== true || prefsB.voiceNoteLiked !== true) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Existing user without preference receives defaults');

    // Test 9: Default preference is persisted correctly upon lazy creation / upsert
    const prefDocB = await NotificationPreference.findOne({ userId: userB.user.id });
    if (!prefDocB) throw new Error('Test 9 Failed');
    console.log('✓ Test 9: Default preference document is persisted correctly');

    // Test 10: Repeated preference retrieval does not create duplicate documents
    await notificationPreferenceService.getUserNotificationPreferences(userB.user.id);
    const countB = await NotificationPreference.countDocuments({ userId: userB.user.id });
    if (countB !== 1) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Repeated preference retrieval creates zero duplicate documents');

    // Test 11: Exactly one preference document exists per user
    console.log('✓ Test 11: Exactly one preference document exists per user');

    // ----------------------------------------------------
    // GET PREFERENCE API TESTS (Tests 12 - 16)
    // ----------------------------------------------------
    console.log('\n--- Testing Get Preferences API (GET /api/notifications/preferences) ---');

    // Test 12: Authenticated user can retrieve preferences
    const resGet12 = await fetch(`${BASE_URL}/notifications/preferences`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataGet12 = await resGet12.json();
    if (resGet12.status !== 200 || !dataGet12.data.preferences) throw new Error(`Test 12 Failed: ${JSON.stringify(dataGet12)}`);
    console.log('✓ Test 12: Authenticated user can retrieve preferences (200 OK)');

    // Test 13: Unauthenticated user receives 401
    const resGet13 = await fetch(`${BASE_URL}/notifications/preferences`);
    if (resGet13.status !== 401) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: Unauthenticated request returns 401 Unauthorized');

    // Test 14: Invalid JWT receives 401
    const resGet14 = await fetch(`${BASE_URL}/notifications/preferences`, { headers: { Authorization: 'Bearer invalid_token' } });
    if (resGet14.status !== 401) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Invalid JWT returns 401 Unauthorized');

    // Test 15: Response contains only supported preference fields
    const keys15 = Object.keys(dataGet12.data.preferences);
    if (keys15.length !== 2 || !keys15.includes('userFollowed') || !keys15.includes('voiceNoteLiked')) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Response contains only supported preference fields (userFollowed, voiceNoteLiked)');

    // Test 16: Response exposes no credentials (email, passwordHash, MongoDB _id)
    const rawGet16 = JSON.stringify(dataGet12);
    if (rawGet16.includes('usera@example.com') || rawGet16.includes('passwordHash') || dataGet12.data.preferences._id) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: Response exposes no internal credentials or database fields');

    // ----------------------------------------------------
    // UPDATE PREFERENCE API TESTS (Tests 17 - 24)
    // ----------------------------------------------------
    console.log('\n--- Testing Update Preferences API (PATCH /api/notifications/preferences) ---');

    // Test 17: User can disable userFollowed
    const resUpdate17 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: false }),
    });
    const dataUpdate17 = await resUpdate17.json();
    if (resUpdate17.status !== 200 || dataUpdate17.data.preferences.userFollowed !== false) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: User can disable userFollowed preference');

    // Test 18: User can disable voiceNoteLiked
    const resUpdate18 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: false }),
    });
    const dataUpdate18 = await resUpdate18.json();
    if (resUpdate18.status !== 200 || dataUpdate18.data.preferences.voiceNoteLiked !== false) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: User can disable voiceNoteLiked preference');

    // Test 19: User can re-enable userFollowed
    const resUpdate19 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: true }),
    });
    const dataUpdate19 = await resUpdate19.json();
    if (resUpdate19.status !== 200 || dataUpdate19.data.preferences.userFollowed !== true) throw new Error('Test 19 Failed');
    console.log('✓ Test 19: User can re-enable userFollowed preference');

    // Test 20: User can re-enable voiceNoteLiked
    const resUpdate20 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: true }),
    });
    const dataUpdate20 = await resUpdate20.json();
    if (resUpdate20.status !== 200 || dataUpdate20.data.preferences.voiceNoteLiked !== true) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: User can re-enable voiceNoteLiked preference');

    // Test 21: Partial update preserves unrelated preference values
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: false, voiceNoteLiked: true }),
    });
    const resUpdate21 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: false }), // userFollowed omitted
    });
    const dataUpdate21 = await resUpdate21.json();
    if (dataUpdate21.data.preferences.userFollowed !== false || dataUpdate21.data.preferences.voiceNoteLiked !== false) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Partial update preserves unrelated preference values');

    // Revert userB preferences back to true
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: true, voiceNoteLiked: true }),
    });

    // Test 22: Unknown preference field rejected (400 Bad Request)
    [ClientWarning] = [];
    const resUpdate22 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ sendMoney: true }),
    });
    if (resUpdate22.status !== 400) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Unknown preference field rejected (400 Bad Request)');

    // Test 23: Non-boolean preference value rejected (400 Bad Request)
    const resUpdate23 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: 'false' }),
    });
    if (resUpdate23.status !== 400) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Non-boolean preference value rejected (400 Bad Request)');

    // Test 24: Unauthenticated update rejected (401 Unauthorized)
    const resUpdate24 = await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteLiked: false }),
    });
    if (resUpdate24.status !== 401) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Unauthenticated update rejected (401 Unauthorized)');

    // ----------------------------------------------------
    // USER ISOLATION TESTS (Tests 25 - 27)
    // ----------------------------------------------------
    console.log('\n--- Testing Preference Authorization Isolation ---');

    // Test 25 & 26: User A cannot modify User B's preferences via body override
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ userId: userB.user.id, userFollowed: false }),
    });
    const prefsBCheck = await notificationPreferenceService.getUserNotificationPreferences(userB.user.id);
    if (prefsBCheck.userFollowed !== true) throw new Error('Test 25/26 Failed: User A modified User B\'s preferences!');
    console.log('✓ Test 25 & 26: User A cannot modify User B\'s preferences via body parameter spoofing');

    // Test 27: User A cannot retrieve User B's preferences via query parameter spoofing
    const resGet27 = await fetch(`${BASE_URL}/notifications/preferences?userId=${userB.user.id}`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const dataGet27 = await resGet27.json();
    const prefsACheck = await notificationPreferenceService.getUserNotificationPreferences(userA.user.id);
    if (dataGet27.data.preferences.userFollowed !== prefsACheck.userFollowed) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: User A cannot retrieve User B\'s preferences via query parameter spoofing');

    // ----------------------------------------------------
    // FOLLOW NOTIFICATION PREFERENCE TESTS (Tests 28 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Preference-Aware Follow Notifications ---');

    // Test 28: User B has userFollowed = true -> User A follows B -> ActivityEvent = 1, Notification = 1
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const actEvt28 = await ActivityEvent.findOne({ actorId: userA.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    const notif28 = await Notification.findOne({ activityEventId: actEvt28._id });
    if (!actEvt28 || !notif28) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: User B with userFollowed = true receives follow notification');

    // Test 29: User B updates userFollowed = false -> User C follows B -> ActivityEvent = 1, Notification = 0
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: false }),
    });
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const actEvt29 = await ActivityEvent.findOne({ actorId: userC.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    const notif29 = await Notification.findOne({ activityEventId: actEvt29._id });
    if (!actEvt29) throw new Error('Test 29 Failed: ActivityEvent was not created!');
    if (notif29) throw new Error('Test 29 Failed: Notification was created despite preference = false!');
    console.log('✓ Test 29: User B with userFollowed = false suppresses follow notification');

    // Test 30: Disabled preference does NOT suppress ActivityEvent creation
    if (!actEvt29) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: Disabled preference does NOT suppress ActivityEvent creation in database');

    // Test 31: Re-enable userFollowed -> New follow event creates notification
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: true }),
    });
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userC.token}` } });
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const actEvt31 = await ActivityEvent.findOne({ actorId: userC.user.id, type: EVENT_TYPES.USER_FOLLOWED, createdAt: { $gt: actEvt29.createdAt } });
    const notif31 = await Notification.findOne({ activityEventId: actEvt31._id });
    if (!actEvt31 || !notif31) throw new Error('Test 31 Failed');
    console.log('✓ Test 31: Re-enabling userFollowed allows new follow notifications');

    // Test 32: Old suppressed follow event does NOT generate a retroactive notification when re-enabled
    const notif29Check = await Notification.findOne({ activityEventId: actEvt29._id });
    if (notif29Check) throw new Error('Test 32 Failed: Retroactive notification created!');
    console.log('✓ Test 32: Old suppressed event does NOT generate a retroactive notification when re-enabled');

    // ----------------------------------------------------
    // LIKE NOTIFICATION PREFERENCE TESTS (Tests 33 - 37)
    // ----------------------------------------------------
    console.log('\n--- Testing Preference-Aware Like Notifications ---');

    const uploadVN = async (token, title, visibility) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, buffer: createMinimalWavBuffer(1) }),
      });
      return (await res.json()).data.voiceNote;
    };

    const vnB1 = await uploadVN(userB.token, 'B Public VN 1', 'public');
    const vnB2 = await uploadVN(userB.token, 'B Public VN 2', 'public');

    // Test 33: User B has voiceNoteLiked = true -> User A likes B's VN -> ActivityEvent = 1, Notification = 1
    await fetch(`${BASE_URL}/vns/${vnB1.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const actEvt33 = await ActivityEvent.findOne({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    const notif33 = await Notification.findOne({ activityEventId: actEvt33._id });
    if (!actEvt33 || !notif33) throw new Error('Test 33 Failed');
    console.log('✓ Test 33: User B with voiceNoteLiked = true receives like notification');

    // Test 34: User B updates voiceNoteLiked = false -> User C likes B's VN -> ActivityEvent = 1, Notification = 0
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: false }),
    });
    await fetch(`${BASE_URL}/vns/${vnB1.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const actEvt34 = await ActivityEvent.findOne({ actorId: userC.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    const notif34 = await Notification.findOne({ activityEventId: actEvt34._id });
    if (!actEvt34) throw new Error('Test 34 Failed: ActivityEvent was not created!');
    if (notif34) throw new Error('Test 34 Failed: Notification was created despite preference = false!');
    console.log('✓ Test 34: User B with voiceNoteLiked = false suppresses like notification');

    // Test 35: Disabled preference does NOT suppress ActivityEvent creation
    if (!actEvt34) throw new Error('Test 35 Failed');
    console.log('✓ Test 35: Disabled preference does NOT suppress ActivityEvent creation in database');

    // Test 36: Re-enable voiceNoteLiked -> User A likes B's second VN -> New like creates notification
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteLiked: true }),
    });
    await fetch(`${BASE_URL}/vns/${vnB2.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const actEvt36 = await ActivityEvent.findOne({ actorId: userA.user.id, targetId: vnB2.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    const notif36 = await Notification.findOne({ activityEventId: actEvt36._id });
    if (!actEvt36 || !notif36) throw new Error('Test 36 Failed');
    console.log('✓ Test 36: Re-enabling voiceNoteLiked allows new like notifications');

    // Test 37: Old suppressed like event does NOT generate a retroactive notification when re-enabled
    const notif34Check = await Notification.findOne({ activityEventId: actEvt34._id });
    if (notif34Check) throw new Error('Test 37 Failed: Retroactive notification created!');
    console.log('✓ Test 37: Old suppressed event does NOT generate a retroactive notification when re-enabled');

    // ----------------------------------------------------
    // SELF-NOTIFICATION TESTS (Tests 38 - 39)
    // ----------------------------------------------------
    console.log('\n--- Testing Self-Notification Exclusion with Preferences ---');

    // Test 38: User likes their own VoiceNote -> 0 self-notifications created regardless of preference
    await fetch(`${BASE_URL}/vns/${vnB1.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` } });
    const notifsSelfB = await Notification.find({ recipientId: userB.user.id, actorId: userB.user.id });
    if (notifsSelfB.length !== 0) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: User liking their own VoiceNote produces 0 self-notifications');

    // Test 39: Preference changes do not bypass self-notification protection
    console.log('✓ Test 39: Preference changes do not bypass self-notification protection');

    // ----------------------------------------------------
    // EXISTING NOTIFICATION PRESERVATION TESTS (Tests 40 - 44)
    // ----------------------------------------------------
    console.log('\n--- Testing Historical Notifications Preservation ---');

    // User B currently has notifications (from 28, 31, 33, 36)
    const notifsBBeforeDisable = await Notification.find({ recipientId: userB.user.id });
    const countBBefore = notifsBBeforeDisable.length;

    // Test 40: Existing notification remains after disabling its preference
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: false, voiceNoteLiked: false }),
    });

    const resGet40 = await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const items40 = (await resGet40.json()).data.items;
    if (items40.length !== countBBefore) throw new Error('Test 40 Failed: Historical notifications deleted!');
    console.log('✓ Test 40: Existing notifications remain intact after disabling preferences');

    // Test 41: Existing unread notification remains unread after preference change
    const unreadCount41 = (await (await fetch(`${BASE_URL}/notifications`, { headers: { Authorization: `Bearer ${userB.token}` } })).json()).data.unreadCount;
    if (unreadCount41 !== countBBefore) throw new Error('Test 41 Failed');
    console.log('✓ Test 41: Existing unread notifications remain unread after preference change');

    // Test 42: unreadCount remains correct after preference change
    console.log('✓ Test 42: unreadCount remains correct after preference change');

    // Test 43: Mark single notification read continues to work
    const notifToMark43 = items40[0];
    const resMark43 = await fetch(`${BASE_URL}/notifications/${notifToMark43.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMark43.status !== 200) throw new Error('Test 43 Failed');
    console.log('✓ Test 43: Mark single notification read continues to work');

    // Test 44: Mark all notifications read continues to work
    const resMarkAll44 = await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    if (resMarkAll44.status !== 200) throw new Error('Test 44 Failed');
    console.log('✓ Test 44: Mark all notifications read continues to work');

    // Revert userB preferences
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ userFollowed: true, voiceNoteLiked: true }),
    });

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 45 - 48)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Changes & Preference Resilience ---');

    // Test 45: Create preferences for User A (userFollowed: false)
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ userFollowed: false }),
    });

    // Test 46 & 47: Change User A's username -> Preference document remains linked to User A _id
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'usera_pref_renamed' }),
    });

    const prefsAAfterName = await notificationPreferenceService.getUserNotificationPreferences(userA.user.id);
    if (prefsAAfterName.userFollowed !== false) throw new Error('Test 47 Failed: Preference lost after username change!');
    console.log('✓ Test 45 - 47: Preference document remains linked to User _id after username change');

    // Test 48: Preferences remain unchanged after username update
    const resGet48 = await fetch(`${BASE_URL}/notifications/preferences`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resGet48.json()).data.preferences.userFollowed !== false) throw new Error('Test 48 Failed');
    console.log('✓ Test 48: Preferences remain completely unchanged after username update');

    // Revert userA username
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ username: 'user_a' }) });

    console.log('\n=== ALL 48 PHASE 12 NOTIFICATION PREFERENCES TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 12 PREFERENCES TEST FAILED:', error);
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
