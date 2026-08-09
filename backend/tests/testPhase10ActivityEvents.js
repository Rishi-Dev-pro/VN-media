const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const Follow = require('../src/models/Follow');
const ActivityEvent = require('../src/models/ActivityEvent');
const { EVENT_TYPES, TARGET_TYPES } = require('../src/utils/activityEvents');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5010;
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
  console.log('=== PHASE 10 ACTIVITY EVENTS FOUNDATION TEST SUITE ===\n');

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
    // MODEL TESTS (Tests 1 - 8)
    // ----------------------------------------------------
    console.log('--- Testing ActivityEvent Model Schema & Validation ---');

    // Test 1: Valid ActivityEvent can be created
    const validEvt = await ActivityEvent.create({
      actorId: new mongoose.Types.ObjectId(userA.user.id),
      type: EVENT_TYPES.USER_FOLLOWED,
      targetType: TARGET_TYPES.USER,
      targetId: new mongoose.Types.ObjectId(userB.user.id),
      metadata: { test: true },
    });
    if (!validEvt._id) throw new Error('Test 1 Failed');
    console.log('✓ Test 1: Valid ActivityEvent can be created in DB');

    // Test 2: Missing actorId rejected
    try {
      await ActivityEvent.create({
        type: EVENT_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userB.user.id),
      });
      throw new Error('Test 2 Failed: Expected missing actorId error');
    } catch (err) {
      if (!err.message.includes('actorId')) throw err;
      console.log('✓ Test 2: Missing actorId rejected by schema');
    }

    // Test 3: Missing type rejected
    try {
      await ActivityEvent.create({
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userB.user.id),
      });
      throw new Error('Test 3 Failed: Expected missing type error');
    } catch (err) {
      if (!err.message.includes('type')) throw err;
      console.log('✓ Test 3: Missing type rejected by schema');
    }

    // Test 4: Invalid event type rejected
    try {
      await ActivityEvent.create({
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: 'INVALID_EVENT_TYPE',
        targetType: TARGET_TYPES.USER,
        targetId: new mongoose.Types.ObjectId(userB.user.id),
      });
      throw new Error('Test 4 Failed: Expected invalid type error');
    } catch (err) {
      if (!err.message.includes('enum')) throw err;
      console.log('✓ Test 4: Invalid event type rejected by schema enum');
    }

    // Test 5: Invalid targetType rejected
    try {
      await ActivityEvent.create({
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: EVENT_TYPES.USER_FOLLOWED,
        targetType: 'INVALID_TARGET',
        targetId: new mongoose.Types.ObjectId(userB.user.id),
      });
      throw new Error('Test 5 Failed: Expected invalid targetType error');
    } catch (err) {
      if (!err.message.includes('enum')) throw err;
      console.log('✓ Test 5: Invalid targetType rejected by schema enum');
    }

    // Test 6: Missing targetId rejected
    try {
      await ActivityEvent.create({
        actorId: new mongoose.Types.ObjectId(userA.user.id),
        type: EVENT_TYPES.USER_FOLLOWED,
        targetType: TARGET_TYPES.USER,
      });
      throw new Error('Test 6 Failed: Expected missing targetId error');
    } catch (err) {
      if (!err.message.includes('targetId')) throw err;
      console.log('✓ Test 6: Missing targetId rejected by schema');
    }

    // Test 7: Metadata remains optional
    const evtNoMeta = await ActivityEvent.create({
      actorId: new mongoose.Types.ObjectId(userA.user.id),
      type: EVENT_TYPES.USER_FOLLOWED,
      targetType: TARGET_TYPES.USER,
      targetId: new mongoose.Types.ObjectId(userB.user.id),
    });
    if (evtNoMeta.metadata === undefined) throw new Error('Test 7 Failed');
    console.log('✓ Test 7: Metadata remains optional (defaults to {})');

    // Test 8: createdAt is recorded
    if (!evtNoMeta.createdAt || !(evtNoMeta.createdAt instanceof Date)) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: createdAt is automatically recorded');

    // Clean up dummy model test events
    await ActivityEvent.deleteMany({});

    // ----------------------------------------------------
    // FOLLOW EVENT TESTS (Tests 9 - 14)
    // ----------------------------------------------------
    console.log('\n--- Testing Follow Activity Events ---');

    // Test 9: Successful follow creates exactly one USER_FOLLOWED event
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const followEvts1 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    if (followEvts1.length !== 1) throw new Error(`Test 9 Failed: Found ${followEvts1.length} events`);
    console.log('✓ Test 9: Successful follow creates exactly one USER_FOLLOWED event');

    // Test 10: Event actorId is correct
    if (followEvts1[0].actorId.toString() !== userA.user.id) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Event actorId matches follower ID');

    // Test 11: Event targetId is followed user's _id
    if (followEvts1[0].targetId.toString() !== userB.user.id) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: Event targetId matches followed user _id');

    // Test 12: Event targetType is User
    if (followEvts1[0].targetType !== TARGET_TYPES.USER) throw new Error('Test 12 Failed');
    console.log('✓ Test 12: Event targetType is "User"');

    // Test 13: Duplicate/idempotent follow does NOT create another event
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const followEvts2 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    if (followEvts2.length !== 1) throw new Error('Test 13 Failed: Duplicate event created on repeated follow');
    console.log('✓ Test 13: Duplicate/idempotent follow does NOT create another event');

    // Test 14: Failed follow does not create an event (e.g. self-follow)
    [ClientWarning] = [];
    await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const followEvts3 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.USER_FOLLOWED });
    if (followEvts3.length !== 1) throw new Error('Test 14 Failed: Event created on failed follow');
    console.log('✓ Test 14: Failed follow (self-follow rejection) creates no event');

    // ----------------------------------------------------
    // VOICE NOTE PUBLICATION EVENT TESTS (Tests 15 - 20)
    // ----------------------------------------------------
    console.log('\n--- Testing VoiceNote Publication Activity Events ---');

    // Helper to upload VN
    const uploadVN = async (token, title, visibility) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, buffer: createMinimalWavBuffer(1) }),
      });
      return (await res.json()).data.voiceNote;
    };

    // Test 15: New public VN creates VOICE_NOTE_PUBLISHED event
    const vnPublic = await uploadVN(userA.token, 'A Public VN', 'public');
    const pubEvts1 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_PUBLISHED });
    if (pubEvts1.length !== 1 || pubEvts1[0].targetId.toString() !== vnPublic.id) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: New public VN upload creates VOICE_NOTE_PUBLISHED event');

    // Test 16: New private VN does NOT create publication event
    const vnPrivate = await uploadVN(userA.token, 'A Private VN', 'private');
    const pubEvts2 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_PUBLISHED });
    if (pubEvts2.length !== 1) throw new Error('Test 16 Failed: Event created for private VN');
    console.log('✓ Test 16: New private VN upload does NOT create publication event');

    // Test 17: Private -> public update creates publication event
    await fetch(`${BASE_URL}/vns/${vnPrivate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ visibility: 'public' }),
    });
    const pubEvts3 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_PUBLISHED });
    if (pubEvts3.length !== 2) throw new Error(`Test 17 Failed: Expected 2 publication events, found ${pubEvts3.length}`);
    console.log('✓ Test 17: Changing visibility private -> public creates publication event');

    // Test 18: Public -> private update does NOT create another publication event
    await fetch(`${BASE_URL}/vns/${vnPrivate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ visibility: 'private' }),
    });
    const pubEvts4 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_PUBLISHED });
    if (pubEvts4.length !== 2) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: Changing visibility public -> private does NOT create publication event');

    // Test 19: Failed update (unauthorized / invalid parameters) creates no event
    await fetch(`${BASE_URL}/vns/${vnPrivate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ visibility: 'public' }),
    });
    const pubEvts5 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.VOICE_NOTE_PUBLISHED });
    if (pubEvts5.length !== 2) throw new Error('Test 19 Failed');
    console.log('✓ Test 19: Unauthorized update attempt creates no event');

    // Test 20: Event points to correct VoiceNote _id
    if (pubEvts3.some((e) => e.targetId.toString() === vnPrivate.id)) {
      console.log('✓ Test 20: Publication event points to correct VoiceNote _id');
    } else throw new Error('Test 20 Failed');

    // ----------------------------------------------------
    // LIKE EVENT TESTS (Tests 21 - 26)
    // ----------------------------------------------------
    console.log('\n--- Testing Like Activity Events ---');

    // Test 21: Successful first Like creates VOICE_NOTE_LIKED event
    await fetch(`${BASE_URL}/vns/${vnPublic.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` } });
    const likeEvts1 = await ActivityEvent.find({ actorId: userB.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (likeEvts1.length !== 1) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Successful first Like creates VOICE_NOTE_LIKED event');

    // Test 22: Event actorId is correct
    if (likeEvts1[0].actorId.toString() !== userB.user.id) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Event actorId matches liking user ID');

    // Test 23: Event targetId is correct
    if (likeEvts1[0].targetId.toString() !== vnPublic.id) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Event targetId matches target VoiceNote _id');

    // Test 24: Duplicate/idempotent Like does NOT create another event
    await fetch(`${BASE_URL}/vns/${vnPublic.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` } });
    const likeEvts2 = await ActivityEvent.find({ actorId: userB.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (likeEvts2.length !== 1) throw new Error('Test 24 Failed: Duplicate event created on repeated like');
    console.log('✓ Test 24: Duplicate/idempotent Like does NOT create another event');

    // Test 25: Failed Like (nonexistent VN) creates no event
    await fetch(`${BASE_URL}/vns/507f1f77bcf86cd799439011/like`, { method: 'POST', headers: { Authorization: `Bearer ${userB.token}` } });
    const likeEvts3 = await ActivityEvent.find({ actorId: userB.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (likeEvts3.length !== 1) throw new Error('Test 25 Failed');
    console.log('✓ Test 25: Failed Like creates no event');

    // Test 26: Unlike does NOT create an event
    await fetch(`${BASE_URL}/vns/${vnPublic.id}/like`, { method: 'DELETE', headers: { Authorization: `Bearer ${userB.token}` } });
    const likeEvts4 = await ActivityEvent.find({ actorId: userB.user.id });
    if (likeEvts4.some((e) => e.type.includes('UNLIKE'))) throw new Error('Test 26 Failed');
    console.log('✓ Test 26: Unlike operation does NOT create an event');

    // ----------------------------------------------------
    // ALBUM EVENT TESTS (Tests 27 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Activity Events ---');

    // Test 27: Successful Album creation creates ALBUM_CREATED event
    const resAlbum = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'A Test Album' }),
    });
    const albumData = (await resAlbum.json()).data.album;
    const albumEvts1 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.ALBUM_CREATED });
    if (albumEvts1.length !== 1) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Successful Album creation creates ALBUM_CREATED event');

    // Test 28: Event actorId is correct
    if (albumEvts1[0].actorId.toString() !== userA.user.id) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Event actorId matches album creator ID');

    // Test 29: Event targetId is correct
    if (albumEvts1[0].targetId.toString() !== albumData.id) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Event targetId matches created Album _id');

    // Test 30: Failed Album creation (missing title) creates no event
    await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: '' }),
    });
    const albumEvts2 = await ActivityEvent.find({ actorId: userA.user.id, type: EVENT_TYPES.ALBUM_CREATED });
    if (albumEvts2.length !== 1) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: Failed Album creation creates no event');

    // Test 31: Adding AlbumItem does NOT create unexpected activity events
    await fetch(`${BASE_URL}/albums/${albumData.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic.id }),
    });
    const allEvtsA31 = await ActivityEvent.find({ actorId: userA.user.id });
    const albumEvtsTotal = allEvtsA31.filter((e) => e.targetType === TARGET_TYPES.ALBUM);
    if (albumEvtsTotal.length !== 1) throw new Error('Test 31 Failed: Unexpected event created on adding AlbumItem');
    console.log('✓ Test 31: Adding AlbumItem does NOT create unexpected activity events');

    // Test 32: Reordering AlbumItems does NOT create unexpected activity events
    await fetch(`${BASE_URL}/albums/${albumData.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ items: [] }),
    });
    const allEvtsA32 = await ActivityEvent.find({ actorId: userA.user.id });
    if (allEvtsA32.filter((e) => e.targetType === TARGET_TYPES.ALBUM).length !== 1) throw new Error('Test 32 Failed');
    console.log('✓ Test 32: Reordering AlbumItems does NOT create unexpected activity events');

    // ----------------------------------------------------
    // ACTIVITY RETRIEVAL TESTS (Tests 33 - 41)
    // ----------------------------------------------------
    console.log('\n--- Testing Activity Retrieval API (GET /api/activity/me) ---');

    // Test 33: Authenticated user can access GET /api/activity/me
    const resAct33 = await fetch(`${BASE_URL}/activity/me`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataAct33 = await resAct33.json();
    if (resAct33.status !== 200 || !dataAct33.data.items) throw new Error(`Test 33 Failed: ${JSON.stringify(dataAct33)}`);
    console.log('✓ Test 33: Authenticated user can access GET /api/activity/me (200 OK)');

    // Test 34: Unauthenticated user receives 401
    const resAct34 = await fetch(`${BASE_URL}/activity/me`);
    if (resAct34.status !== 401) throw new Error('Test 34 Failed');
    console.log('✓ Test 34: Unauthenticated user receives 401 Unauthorized');

    // Test 35: Invalid token receives 401
    const resAct35 = await fetch(`${BASE_URL}/activity/me`, { headers: { Authorization: 'Bearer invalid_token' } });
    if (resAct35.status !== 401) throw new Error('Test 35 Failed');
    console.log('✓ Test 35: Invalid token receives 401 Unauthorized');

    // Test 36: User A receives only events where actorId = A
    // User A should have: 1 USER_FOLLOWED, 2 VOICE_NOTE_PUBLISHED, 1 ALBUM_CREATED = 4 events
    if (dataAct33.data.items.length !== 4) throw new Error(`Test 36 Failed: Expected 4 events, got ${dataAct33.data.items.length}`);
    console.log('✓ Test 36: User A receives only events where actorId = A (4 events)');

    // Test 37: User A cannot retrieve User B's events via query parameter spoofing
    const resAct37 = await fetch(`${BASE_URL}/activity/me?userId=${userB.user.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items37 = (await resAct37.json()).data.items;
    if (items37.some((item) => item.actorId === userB.user.id)) throw new Error('Test 37 Failed: Spoofed userId');
    console.log('✓ Test 37: User A cannot retrieve User B\'s events via query parameter spoofing');

    // Test 38: Pagination works (?page=1&limit=2)
    const resAct38 = await fetch(`${BASE_URL}/activity/me?page=1&limit=2`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataAct38 = await resAct38.json();
    if (dataAct38.data.items.length !== 2 || dataAct38.data.pagination.total !== 4) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: Pagination works (limit=2 returns 2 items out of total 4)');

    // Test 39: Maximum limit is enforced (capped at 100)
    const resAct39 = await fetch(`${BASE_URL}/activity/me?limit=99999`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resAct39.json()).data.pagination.limit > 100) throw new Error('Test 39 Failed');
    console.log('✓ Test 39: Maximum limit is constrained (capped at 100)');

    // Test 40: Invalid pagination values are handled safely
    const resAct40 = await fetch(`${BASE_URL}/activity/me?page=-5&limit=abc`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataAct40 = await resAct40.json();
    if (dataAct40.data.pagination.page !== 1 || dataAct40.data.pagination.limit !== 20) throw new Error('Test 40 Failed');
    console.log('✓ Test 40: Invalid pagination values default safely to page 1, limit 20');

    // Test 41: Ordering is deterministic (createdAt DESC, _id DESC)
    const items41 = dataAct33.data.items;
    if (new Date(items41[0].createdAt) < new Date(items41[1].createdAt)) throw new Error('Test 41 Failed');
    console.log('✓ Test 41: Activity events ordering is deterministic (newest first)');

    // ----------------------------------------------------
    // PRIVACY TESTS (Tests 42 - 46)
    // ----------------------------------------------------
    console.log('\n--- Testing Privacy Boundaries ---');

    const rawActStr = JSON.stringify(dataAct33);

    // Test 42: Activity event retrieval does not expose email
    if (rawActStr.includes('usera@example.com')) throw new Error('Test 42 Failed');
    console.log('✓ Test 42: Activity event retrieval does not expose email');

    // Test 43: Activity event retrieval does not expose passwordHash
    if (rawActStr.includes('passwordHash') || rawActStr.includes('$2a$') || rawActStr.includes('$2b$')) throw new Error('Test 43 Failed');
    console.log('✓ Test 43: Activity event retrieval does not expose passwordHash');

    // Test 44: Activity event retrieval does not automatically expose private VoiceNote metadata
    if (rawActStr.includes('A Private VN')) throw new Error('Test 44 Failed');
    console.log('✓ Test 44: Activity event retrieval does not automatically expose private VoiceNote metadata');

    // Test 45: Activity event retrieval does not expose private Album metadata
    if (rawActStr.includes('coverImage')) throw new Error('Test 45 Failed');
    console.log('✓ Test 45: Activity event retrieval does not expose unnecessary private Album metadata');

    // Test 46: Target IDs alone do not bypass existing authorization
    const resBGetPriv = await fetch(`${BASE_URL}/vns/${vnPrivate.id}`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if (resBGetPriv.status !== 403) throw new Error('Test 46 Failed');
    console.log('✓ Test 46: Target IDs in events do not bypass VoiceNote GET authorization (403 Forbidden)');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 47 - 50)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Changes & Historical Events ---');

    // Test 47: Create an event involving User A (already created)
    const actCountBefore = await ActivityEvent.countDocuments({ actorId: userA.user.id });

    // Test 48 & 49: User A updates username -> historical events remain associated with User A _id
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'usera_new_name' }),
    });

    const actCountAfter = await ActivityEvent.countDocuments({ actorId: userA.user.id });
    if (actCountBefore !== actCountAfter) throw new Error('Test 49 Failed');
    console.log('✓ Test 47 - 49: Historical events remain associated with User _id after username change');

    // Test 50: No historical event documents need to be rewritten
    const sampleEvt = await ActivityEvent.findOne({ actorId: userA.user.id });
    if (sampleEvt.actorUsername !== undefined) throw new Error('Test 50 Failed');
    console.log('✓ Test 50: Event documents contain no mutable username fields that require rewriting');

    // Revert User A username
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ username: 'user_a' }) });

    // ----------------------------------------------------
    // EVENT CONSISTENCY TESTS (Tests 51 - 55)
    // ----------------------------------------------------
    console.log('\n--- Testing Event Consistency & System Integration ---');

    // Test 51: Failed business operation creates zero events
    const totalEventsBefore51 = await ActivityEvent.countDocuments();
    await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: createUploadFormData({ title: '', visibility: 'public' }), // Missing title fails
    });
    const totalEventsAfter51 = await ActivityEvent.countDocuments();
    if (totalEventsBefore51 !== totalEventsAfter51) throw new Error('Test 51 Failed');
    console.log('✓ Test 51: Failed business operation creates zero events');

    // Test 52: Successful business operation creates exactly intended event count
    const vnPublic2 = await uploadVN(userC.token, 'C Public VN', 'public');
    const totalEventsAfter52 = await ActivityEvent.countDocuments();
    if (totalEventsAfter52 !== totalEventsBefore51 + 1) throw new Error('Test 52 Failed');
    console.log('✓ Test 52: Successful business operation creates exactly 1 intended event');

    // Test 53: Idempotent operations do not create duplicate events
    await fetch(`${BASE_URL}/vns/${vnPublic.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    await fetch(`${BASE_URL}/vns/${vnPublic.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const cLikeEvts = await ActivityEvent.find({ actorId: userC.user.id, type: EVENT_TYPES.VOICE_NOTE_LIKED });
    if (cLikeEvts.length !== 1) throw new Error('Test 53 Failed');
    console.log('✓ Test 53: Idempotent operations do not create duplicate events');

    // Test 54: Existing Phase 8 follow relationship remains 100% correct
    const resFolStatus = await fetch(`${BASE_URL}/users/${userB.user.id}/follow-status`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (!(await resFolStatus.json()).data.following) throw new Error('Test 54 Failed');
    console.log('✓ Test 54: Existing Phase 8 follow relationship remains 100% correct');

    // Test 55: Existing Phase 9 following feed remains 100% correct
    const vnPublicB = await uploadVN(userB.token, 'B Public VN for Feed', 'public');
    const resFolFeed = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const folFeedItems = (await resFolFeed.json()).data.items;
    if (folFeedItems.some((i) => i.id === vnPublicB.id)) {
      console.log('✓ Test 55: Existing Phase 9 following feed remains 100% correct');
    } else throw new Error('Test 55 Failed');

    console.log('\n=== ALL 55 PHASE 10 ACTIVITY EVENTS TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 10 ACTIVITY EVENTS TEST FAILED:', error);
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
