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
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5016;
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
  if (tags !== undefined) form.append('tags', typeof tags === 'string' ? tags : JSON.stringify(tags));

  if (buffer) {
    const fileBlob = new Blob([buffer], { type: mimeType });
    form.append('audio', fileBlob, filename);
  }

  return form;
}

const runTests = async () => {
  console.log('=== PHASE 16 CONTENT ENGAGEMENT & SOCIAL METRICS TEST SUITE ===\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.log(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    await mongoose.connection.db.dropDatabase();
    await User.syncIndexes();
    await VoiceNote.syncIndexes();
    await Like.syncIndexes();
    await Album.syncIndexes();
    await AlbumItem.syncIndexes();
    await Follow.syncIndexes();
    await ActivityEvent.syncIndexes();
    await Notification.syncIndexes();
    await NotificationPreference.syncIndexes();
    console.log('[Test DB] Cleared test DB and synced indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login Test Users (A, B, C)
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a16', email: 'usera16@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera16@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b16', email: 'userb16@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb16@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c16', email: 'userc16@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc16@example.com', password: 'password123' }),
    });
    const userCData = await loginCRes.json();
    const tokenC = userCData.data.token;
    const userCId = userCData.data.user.id;

    console.log('[Setup] Three test users created and logged in\n');

    // 4. Create test VoiceNotes
    const wavBuffer = createMinimalWavBuffer(1);

    // User B creates a public VoiceNote
    const createPublicRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Public Engagement VN', description: 'Public VN for engagement tests', visibility: 'public', tags: ['engagement', 'test'], buffer: wavBuffer }),
    });
    const publicVnData = await createPublicRes.json();
    const publicVnId = publicVnData.data.voiceNote.id;

    // User B creates a private VoiceNote
    const createPrivateRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Private Engagement VN', description: 'Private VN', visibility: 'private', buffer: wavBuffer }),
    });
    const privateVnData = await createPrivateRes.json();
    const privateVnId = privateVnData.data.voiceNote.id;

    // User A creates a public VoiceNote (for self-like tests)
    const createSelfRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Self Like VN', description: 'For self-like tests', visibility: 'public', tags: ['engagement'], buffer: wavBuffer }),
    });
    const selfVnData = await createSelfRes.json();
    const selfVnId = selfVnData.data.voiceNote.id;

    // User B creates a VoiceNote to be deleted
    const createDeleteRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'To Delete VN', description: 'Will be deleted', visibility: 'public', buffer: wavBuffer }),
    });
    const deleteVnData = await createDeleteRes.json();
    const deletedVnId = deleteVnData.data.voiceNote.id;

    // Soft-delete the VoiceNote
    await fetch(`${BASE_URL}/vns/${deletedVnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });

    console.log('[Setup] Test VoiceNotes created\n');

    // ================================
    // SECTION 1: LIKE / UNLIKE MECHANICS (Tests 1-10)
    // ================================
    console.log('--- LIKE / UNLIKE MECHANICS ---');

    // Test 1: Authenticated user can Like public active VoiceNote
    const likeRes1 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likeData1 = await likeRes1.json();
    assert(likeRes1.status === 200 && likeData1.success === true && likeData1.data.liked === true, 'Test 1: Authenticated user can Like public active VoiceNote');

    // Test 2: Unauthenticated Like rejected with 401
    const likeRes2 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
    });
    assert(likeRes2.status === 401, 'Test 2: Unauthenticated Like rejected with 401');

    // Test 3: User cannot Like inaccessible private VoiceNote
    const likeRes3 = await fetch(`${BASE_URL}/vns/${privateVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(likeRes3.status === 403, 'Test 3: User cannot Like inaccessible private VoiceNote');

    // Test 4: User cannot Like deleted VoiceNote
    const likeRes4 = await fetch(`${BASE_URL}/vns/${deletedVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(likeRes4.status === 404, 'Test 4: User cannot Like deleted VoiceNote');

    // Test 5: Duplicate Like is prevented (idempotent)
    const likeRes5 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likeData5 = await likeRes5.json();
    assert(likeRes5.status === 200 && likeData5.data.liked === true, 'Test 5: Duplicate Like is prevented (idempotent response)');

    // Test 6: Unique database constraint remains enforced
    const likeCount6 = await Like.countDocuments({ userId: userAId, voiceNoteId: publicVnId });
    assert(likeCount6 === 1, 'Test 6: Unique database constraint remains enforced (exactly 1 Like)');

    // Test 7: User can Unlike their own Like
    const unlikeRes7 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const unlikeData7 = await unlikeRes7.json();
    assert(unlikeRes7.status === 200 && unlikeData7.data.liked === false, 'Test 7: User can Unlike their own Like');

    // Test 8: User cannot remove another user's Like
    // User C likes the public VN first
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    // User A tries to unlike (should only affect A's Like which doesn't exist)
    const unlikeRes8 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const unlikeData8 = await unlikeRes8.json();
    assert(unlikeRes8.status === 200 && unlikeData8.data.liked === false, "Test 8: User cannot remove another user's Like (idempotent unlike)");
    // Verify User C's Like still exists
    const cLikeExists = await Like.exists({ userId: userCId, voiceNoteId: publicVnId });
    assert(Boolean(cLikeExists), "Test 8b: User C's Like still exists after User A unlike");

    // Test 9: Like count increases correctly
    // User A likes again
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likesRes9 = await fetch(`${BASE_URL}/vns/${publicVnId}/likes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likesData9 = await likesRes9.json();
    assert(likesData9.data.count === 2, 'Test 9: Like count increases correctly (count = 2 after A + C)');

    // Test 10: Like count decreases correctly
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likesRes10 = await fetch(`${BASE_URL}/vns/${publicVnId}/likes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likesData10 = await likesRes10.json();
    assert(likesData10.data.count === 1, 'Test 10: Like count decreases correctly (count = 1 after A unlike)');

    console.log('');

    // ================================
    // SECTION 2: ENGAGEMENT RESPONSE TESTS (Tests 11-16)
    // ================================
    console.log('--- ENGAGEMENT RESPONSE TESTS ---');

    // Re-like from A for subsequent tests
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    // Test 11: Public VoiceNote includes correct likeCount
    const vnRes11 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const vnData11 = await vnRes11.json();
    assert(
      vnData11.data.voiceNote.likeCount === 2 && typeof vnData11.data.voiceNote.likeCount === 'number',
      'Test 11: Public VoiceNote includes correct likeCount (= 2)'
    );

    // Test 12: Authenticated user who liked it receives likedByMe = true
    assert(
      vnData11.data.voiceNote.likedByMe === true,
      'Test 12: Authenticated user who liked it receives likedByMe = true'
    );

    // Test 13: Authenticated user who did not like it receives likedByMe = false
    // User B did not like their own VoiceNote
    const vnRes13 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const vnData13 = await vnRes13.json();
    assert(
      vnData13.data.voiceNote.likedByMe === false,
      'Test 13: Authenticated user who did not like it receives likedByMe = false'
    );

    // Test 14: Guest does not receive another user's identity (no email, no likers list)
    const vnRes14 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'GET',
    });
    const vnData14 = await vnRes14.json();
    const vn14 = vnData14.data.voiceNote;
    assert(
      typeof vn14.likeCount === 'number' &&
      vn14.likedByMe === false &&
      !vn14.likers &&
      !vn14.email &&
      !vn14.passwordHash,
      'Test 14: Guest does not receive another user identity or likers list'
    );

    // Test 15: Private VoiceNote cannot leak Like metadata
    const vnRes15 = await fetch(`${BASE_URL}/vns/${privateVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(vnRes15.status === 403, 'Test 15: Private VoiceNote cannot leak Like metadata (403 for non-owner)');

    // Test 16: Deleted VoiceNote cannot leak Like metadata
    const vnRes16 = await fetch(`${BASE_URL}/vns/${deletedVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(vnRes16.status === 404, 'Test 16: Deleted VoiceNote cannot leak Like metadata (404)');

    console.log('');

    // ================================
    // SECTION 3: FEED CONSISTENCY TESTS (Tests 17-22)
    // ================================
    console.log('--- FEED CONSISTENCY TESTS ---');

    // Test 17: Public feed includes engagement metadata
    const feedRes17 = await fetch(`${BASE_URL}/vns/feed`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const feedData17 = await feedRes17.json();
    const publicFeedVn = feedData17.data.voiceNotes.find((vn) => vn.id === publicVnId);
    assert(
      publicFeedVn && typeof publicFeedVn.likeCount === 'number' && typeof publicFeedVn.likedByMe === 'boolean',
      'Test 17: Public feed includes engagement metadata (likeCount + likedByMe)'
    );

    // Test 18: Search includes engagement metadata
    const searchRes18 = await fetch(`${BASE_URL}/vns/search?q=Engagement`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const searchData18 = await searchRes18.json();
    const searchVn = searchData18.data.items.find((vn) => vn.id === publicVnId);
    assert(
      searchVn && typeof searchVn.likeCount === 'number' && typeof searchVn.likedByMe === 'boolean',
      'Test 18: Search includes engagement metadata (likeCount + likedByMe)'
    );

    // Test 19: Tag discovery includes engagement metadata
    const tagRes19 = await fetch(`${BASE_URL}/vns/tags/engagement`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const tagData19 = await tagRes19.json();
    const tagVn = tagData19.data.items.find((vn) => vn.id === publicVnId);
    assert(
      tagVn && typeof tagVn.likeCount === 'number' && typeof tagVn.likedByMe === 'boolean',
      'Test 19: Tag discovery includes engagement metadata (likeCount + likedByMe)'
    );

    // Test 20: Creator profile VoiceNotes include engagement metadata
    const creatorRes20 = await fetch(`${BASE_URL}/users/user_b16/voice-notes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const creatorData20 = await creatorRes20.json();
    const creatorVn = creatorData20.data.voiceNotes.find((vn) => vn.id === publicVnId);
    assert(
      creatorVn && typeof creatorVn.likeCount === 'number' && typeof creatorVn.likedByMe === 'boolean',
      'Test 20: Creator profile VoiceNotes include engagement metadata'
    );

    // Test 21: Following feed includes engagement metadata
    // User A follows User B first
    await fetch(`${BASE_URL}/users/${userBId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const followingRes21 = await fetch(`${BASE_URL}/vns/feed/following`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const followingData21 = await followingRes21.json();
    const followingVn = followingData21.data.items.find((vn) => vn.id === publicVnId);
    assert(
      followingVn && typeof followingVn.likeCount === 'number' && typeof followingVn.likedByMe === 'boolean',
      'Test 21: Following feed includes engagement metadata'
    );

    // Test 22: Single VoiceNote retrieval includes engagement metadata
    const singleRes22 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const singleData22 = await singleRes22.json();
    assert(
      singleData22.data.voiceNote.likeCount === 2 && singleData22.data.voiceNote.likedByMe === true,
      'Test 22: Single VoiceNote retrieval has correct engagement metadata (likeCount=2, likedByMe=true)'
    );

    // Verify consistency: likeCount should be the same across all endpoints
    const allLikeCounts = [
      publicFeedVn?.likeCount,
      searchVn?.likeCount,
      tagVn?.likeCount,
      creatorVn?.likeCount,
      followingVn?.likeCount,
      singleData22.data.voiceNote.likeCount,
    ];
    const allSame = allLikeCounts.every((c) => c === allLikeCounts[0]);
    assert(allSame, 'Test 22b: likeCount is consistent across all 6 endpoints');

    console.log('');

    // ================================
    // SECTION 4: N+1 PREVENTION (Test 23)
    // ================================
    console.log('--- N+1 PREVENTION ---');

    // Create 20 VoiceNotes to test batch enrichment
    const bulkVnIds = [];
    for (let i = 0; i < 20; i++) {
      const bRes = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenB}` },
        body: createUploadFormData({ title: `Bulk VN ${i}`, visibility: 'public', tags: ['bulktest'], buffer: wavBuffer }),
      });
      const bData = await bRes.json();
      bulkVnIds.push(bData.data.voiceNote.id);
    }
    // Like some of them
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE_URL}/vns/${bulkVnIds[i]}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
      });
    }

    // Enable mongoose debug to count queries
    let queryCount = 0;
    const originalDebug = mongoose.get('debug');
    mongoose.set('debug', (collectionName, method) => {
      if (collectionName === 'likes') {
        queryCount++;
      }
    });

    // Fetch bulk tag feed
    queryCount = 0;
    const bulkFeedRes = await fetch(`${BASE_URL}/vns/tags/bulktest`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const bulkFeedData = await bulkFeedRes.json();

    mongoose.set('debug', originalDebug || false);

    // With batched queries, we expect exactly 2 Like queries (aggregate + find)
    // With N+1, we would see 20+ queries
    assert(
      queryCount <= 4 && bulkFeedData.data.items.length === 20,
      `Test 23: N+1 prevention — 20 VoiceNotes enriched with ${queryCount} Like queries (expected ≤ 4, got ${queryCount})`
    );

    // Verify enrichment correctness
    const likedBulkVns = bulkFeedData.data.items.filter((vn) => vn.likedByMe === true);
    assert(
      likedBulkVns.length === 10,
      `Test 23b: Batch enrichment correctly identifies 10 liked VNs out of 20`
    );

    console.log('');

    // ================================
    // SECTION 5: ACTIVITY EVENT TESTS (Tests 24-27)
    // ================================
    console.log('--- ACTIVITY EVENT TESTS ---');

    // Create a fresh VoiceNote for clean activity event tests
    const freshVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Activity Event VN', visibility: 'public', buffer: wavBuffer }),
    });
    const freshVnData = await freshVnRes.json();
    const freshVnId = freshVnData.data.voiceNote.id;

    // Test 24: Successful Like creates exactly one VOICE_NOTE_LIKED ActivityEvent
    const aeCountBefore = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: freshVnId,
    });
    await fetch(`${BASE_URL}/vns/${freshVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const aeCountAfter = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: freshVnId,
    });
    assert(aeCountAfter - aeCountBefore === 1, 'Test 24: Successful Like creates exactly 1 VOICE_NOTE_LIKED ActivityEvent');

    // Test 25: Duplicate Like creates zero additional events
    await fetch(`${BASE_URL}/vns/${freshVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const aeCountAfterDup = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: freshVnId,
    });
    assert(aeCountAfterDup === aeCountAfter, 'Test 25: Duplicate Like creates zero additional ActivityEvents');

    // Test 26: Unlike creates zero new Like events
    const aeCountBeforeUnlike = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: freshVnId,
    });
    await fetch(`${BASE_URL}/vns/${freshVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const aeCountAfterUnlike = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: freshVnId,
    });
    assert(aeCountAfterUnlike === aeCountBeforeUnlike, 'Test 26: Unlike creates zero new ActivityEvents');

    // Test 27: Failed Like (deleted VN) creates zero events
    const aeCountBeforeFail = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
    });
    await fetch(`${BASE_URL}/vns/${deletedVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const aeCountAfterFail = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
    });
    assert(aeCountAfterFail === aeCountBeforeFail, 'Test 27: Failed Like (deleted VN) creates zero ActivityEvents');

    console.log('');

    // ================================
    // SECTION 6: NOTIFICATION TESTS (Tests 28-32)
    // ================================
    console.log('--- NOTIFICATION TESTS ---');

    // Create a fresh VoiceNote for clean notification tests
    const notifVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Notification VN', visibility: 'public', buffer: wavBuffer }),
    });
    const notifVnData = await notifVnRes.json();
    const notifVnId = notifVnData.data.voiceNote.id;

    // Test 28: Successful Like creates notification for VN owner
    const notifCountBefore = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
    });
    await fetch(`${BASE_URL}/vns/${notifVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    // Small delay for async notification creation
    await new Promise((r) => setTimeout(r, 200));
    const notifCountAfter = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
    });
    assert(notifCountAfter - notifCountBefore === 1, 'Test 28: Successful Like creates notification for VN owner');

    // Test 29: Duplicate Like creates no additional notification
    await fetch(`${BASE_URL}/vns/${notifVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    await new Promise((r) => setTimeout(r, 200));
    const notifCountAfterDup = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
    });
    assert(notifCountAfterDup === notifCountAfter, 'Test 29: Duplicate Like creates no additional notification');

    // Test 30: Self-Like creates no self-notification
    const selfNotifBefore = await Notification.countDocuments({
      recipientId: userAId,
      type: 'VOICE_NOTE_LIKED',
    });
    await fetch(`${BASE_URL}/vns/${selfVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    await new Promise((r) => setTimeout(r, 200));
    const selfNotifAfter = await Notification.countDocuments({
      recipientId: userAId,
      type: 'VOICE_NOTE_LIKED',
    });
    assert(selfNotifAfter === selfNotifBefore, 'Test 30: Self-Like creates no self-notification');

    // Test 31: Disabled voiceNoteLiked preference suppresses notification
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteLiked: false }),
    });
    const suppressVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Suppressed Notif VN', visibility: 'public', buffer: wavBuffer }),
    });
    const suppressVnData = await suppressVnRes.json();
    const suppressVnId = suppressVnData.data.voiceNote.id;
    const suppressNotifBefore = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
    });
    await fetch(`${BASE_URL}/vns/${suppressVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    await new Promise((r) => setTimeout(r, 200));
    const suppressNotifAfter = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
    });
    assert(suppressNotifAfter === suppressNotifBefore, 'Test 31: Disabled voiceNoteLiked preference suppresses notification');

    // Test 32: Disabled preference still preserves ActivityEvent
    const suppressAeCount = await ActivityEvent.countDocuments({
      actorId: userCId,
      type: 'VOICE_NOTE_LIKED',
      targetId: suppressVnId,
    });
    assert(suppressAeCount === 1, 'Test 32: Disabled preference still preserves ActivityEvent');

    // Restore preference
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteLiked: true }),
    });

    console.log('');

    // ================================
    // SECTION 7: REAL-TIME REGRESSION TESTS (Tests 33-36)
    // ================================
    console.log('--- REAL-TIME REGRESSION TESTS ---');

    // Test 33: Successful Like produces persisted notification (real-time delivery verified by persistence)
    const rtVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Realtime VN', visibility: 'public', buffer: wavBuffer }),
    });
    const rtVnData = await rtVnRes.json();
    const rtVnId = rtVnData.data.voiceNote.id;

    await fetch(`${BASE_URL}/vns/${rtVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    await new Promise((r) => setTimeout(r, 200));
    const rtNotif = await Notification.findOne({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
      targetId: rtVnId,
    });
    assert(rtNotif !== null, 'Test 33: Successful Like produces persisted notification for real-time delivery');

    // Test 34: Duplicate Like produces no duplicate notification
    await fetch(`${BASE_URL}/vns/${rtVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    await new Promise((r) => setTimeout(r, 200));
    const rtNotifCount = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
      targetId: rtVnId,
    });
    assert(rtNotifCount === 1, 'Test 34: Duplicate Like produces no duplicate notification');

    // Test 35: Self-Like produces no notification (already verified in Test 30, confirm via notification API)
    const selfNotifRes = await fetch(`${BASE_URL}/notifications?limit=100`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const selfNotifData = await selfNotifRes.json();
    const selfNotifItems = selfNotifData.data.items || [];
    const selfLikeNotifs = selfNotifItems.filter(
      (n) => n.type === 'VOICE_NOTE_LIKED' && n.targetId === selfVnId
    );
    assert(selfLikeNotifs.length === 0, 'Test 35: Self-Like produces no notification (verified via API)');

    // Test 36: Offline recipient still receives persisted Notification
    // This is inherently verified by Test 33 — the notification was persisted even without a socket connection
    assert(rtNotif && rtNotif.readAt === null, 'Test 36: Offline recipient has unread persisted Notification');

    console.log('');

    // ================================
    // SECTION 8: USER ISOLATION TESTS (Tests 37-39)
    // ================================
    console.log('--- USER ISOLATION TESTS ---');

    // Test 37: User C cannot remove A's Like via unlike
    // User A likes publicVnId (already liked)
    const aLikeExists37 = await Like.exists({ userId: userAId, voiceNoteId: publicVnId });
    assert(Boolean(aLikeExists37), 'Test 37 setup: User A has an active Like');

    // User C tries to unlike the same VN (should only affect C's Like, not A's)
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    // Verify A's Like still exists
    const aLikeStill37 = await Like.exists({ userId: userAId, voiceNoteId: publicVnId });
    assert(Boolean(aLikeStill37), "Test 37: User C cannot remove User A's Like");

    // Test 38: User cannot spoof userId in body for like
    const spoofRes38 = await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userCId }),
    });
    // Like should use req.user._id, not body.userId
    assert(spoofRes38.status === 200, 'Test 38: Like ignores spoofed userId in body (uses req.user._id)');
    // Verify no Like was created for userC from this request
    const spoofLikeCount = await Like.countDocuments({ userId: userCId, voiceNoteId: publicVnId });
    // C previously unliked, so should be 0
    assert(spoofLikeCount === 0, 'Test 38b: No Like created for spoofed userId');

    // Test 39: User cannot spoof userId via query params
    const spoofRes39 = await fetch(`${BASE_URL}/vns/${publicVnId}/like?userId=${userCId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(spoofRes39.status === 200, 'Test 39: Like ignores spoofed userId in query params');

    console.log('');

    // ================================
    // SECTION 9: CONCURRENCY / RACE TEST (Test 40)
    // ================================
    console.log('--- CONCURRENCY / RACE TEST ---');

    const raceVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Race VN', visibility: 'public', buffer: wavBuffer }),
    });
    const raceVnData = await raceVnRes.json();
    const raceVnId = raceVnData.data.voiceNote.id;

    // Issue 10 simultaneous Like requests from the same user
    const racePromises = [];
    for (let i = 0; i < 10; i++) {
      racePromises.push(
        fetch(`${BASE_URL}/vns/${raceVnId}/like`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}` },
        })
      );
    }
    await Promise.all(racePromises);
    await new Promise((r) => setTimeout(r, 300));

    const raceLikeCount = await Like.countDocuments({ userId: userAId, voiceNoteId: raceVnId });
    const raceAeCount = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: raceVnId,
    });
    const raceNotifCount = await Notification.countDocuments({
      recipientId: userBId,
      type: 'VOICE_NOTE_LIKED',
      targetId: raceVnId,
    });
    assert(raceLikeCount === 1, `Test 40: Concurrent Likes create exactly 1 Like (got ${raceLikeCount})`);
    assert(raceAeCount === 1, `Test 40b: Concurrent Likes create exactly 1 ActivityEvent (got ${raceAeCount})`);
    assert(raceNotifCount <= 1, `Test 40c: Concurrent Likes create at most 1 Notification (got ${raceNotifCount})`);

    console.log('');

    // ================================
    // SECTION 10: RELATIONSHIP STABILITY TESTS (Tests 41-43)
    // ================================
    console.log('--- RELATIONSHIP STABILITY TESTS ---');

    // Test 41: Like survives VoiceNote metadata update
    await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Engagement VN' }),
    });
    const likeAfterUpdate = await Like.exists({ userId: userAId, voiceNoteId: publicVnId });
    assert(Boolean(likeAfterUpdate), 'Test 41: Like survives VoiceNote metadata update');

    // Test 42: Like survives username change
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a16_renamed' }),
    });
    const likeAfterRename = await Like.exists({ userId: userAId, voiceNoteId: publicVnId });
    assert(Boolean(likeAfterRename), 'Test 42: Like survives username change');

    // Rename back
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a16' }),
    });

    // Test 43: Like count consistent after VoiceNote soft deletion
    // Create a VoiceNote, like it, delete it, verify like count cannot be queried
    const delTestRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Delete Test VN', visibility: 'public', buffer: wavBuffer }),
    });
    const delTestData = await delTestRes.json();
    const delTestVnId = delTestData.data.voiceNote.id;
    await fetch(`${BASE_URL}/vns/${delTestVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    // Soft delete
    await fetch(`${BASE_URL}/vns/${delTestVnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    // Verify engagement cannot be queried
    const delLikeRes = await fetch(`${BASE_URL}/vns/${delTestVnId}/likes`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delLikeRes.status === 404, 'Test 43: Deleted VoiceNote engagement metadata unavailable (404)');

    console.log('');

    // ================================
    // SECTION 11: ALBUM CONSISTENCY (Test 44)
    // ================================
    console.log('--- ALBUM CONSISTENCY ---');

    // Create a public album and add publicVnId to it
    const albumRes = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Engagement Album', visibility: 'public' }),
    });
    const albumData = await albumRes.json();
    const albumId = albumData.data.album.id;

    await fetch(`${BASE_URL}/albums/${albumId}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteId: publicVnId }),
    });

    const albumDetailRes = await fetch(`${BASE_URL}/albums/${albumId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const albumDetailData = await albumDetailRes.json();
    const albumVn = albumDetailData.data.items.find((item) => item.voiceNote && item.voiceNote.id === publicVnId);
    assert(
      albumVn && typeof albumVn.voiceNote.likeCount === 'number' && typeof albumVn.voiceNote.likedByMe === 'boolean',
      'Test 44: Album VoiceNotes contain engagement metadata (likeCount + likedByMe)'
    );

    // Verify album engagement metadata matches single VN endpoint
    const singleVnRes44 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const singleVnData44 = await singleVnRes44.json();
    assert(
      albumVn.voiceNote.likeCount === singleVnData44.data.voiceNote.likeCount,
      'Test 44b: Album VoiceNote likeCount matches single VN endpoint'
    );

    console.log('');

    // ================================
    // SECTION 12: LIKE COUNT IN LIKE/UNLIKE RESPONSES (Test 45-46)
    // ================================
    console.log('--- LIKE/UNLIKE RESPONSE COUNTS ---');

    const countVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Count Response VN', visibility: 'public', buffer: wavBuffer }),
    });
    const countVnData = await countVnRes.json();
    const countVnId = countVnData.data.voiceNote.id;

    // Test 45: Like response includes accurate likeCount
    const likeCountRes = await fetch(`${BASE_URL}/vns/${countVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const likeCountData = await likeCountRes.json();
    assert(
      likeCountData.data.likeCount === 1 && likeCountData.data.liked === true,
      'Test 45: Like response includes accurate likeCount (= 1)'
    );

    // Test 46: Unlike response includes accurate likeCount
    const unlikeCountRes = await fetch(`${BASE_URL}/vns/${countVnId}/like`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const unlikeCountData = await unlikeCountRes.json();
    assert(
      unlikeCountData.data.likeCount === 0 && unlikeCountData.data.liked === false,
      'Test 46: Unlike response includes accurate likeCount (= 0)'
    );

    console.log('');

    // ================================
    // SECTION 13: SELF-LIKE BEHAVIOR (Test 47)
    // ================================
    console.log('--- SELF-LIKE BEHAVIOR ---');

    // Test 47: Self-Like preserves existing behavior (allowed, creates ActivityEvent, no notification)
    const selfAeCount = await ActivityEvent.countDocuments({
      actorId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: selfVnId,
    });
    assert(selfAeCount === 1, 'Test 47: Self-Like creates ActivityEvent (existing behavior preserved)');
    const selfNotifCount = await Notification.countDocuments({
      recipientId: userAId,
      type: 'VOICE_NOTE_LIKED',
      targetId: selfVnId,
    });
    assert(selfNotifCount === 0, 'Test 47b: Self-Like creates no self-notification');

    console.log('');

    // ================================
    // SECTION 14: GUEST FEED TESTS (Test 48)
    // ================================
    console.log('--- GUEST FEED TESTS ---');

    // Test 48: Guest feed has likeCount but likedByMe = false
    const guestFeedRes = await fetch(`${BASE_URL}/vns/feed?limit=100`);
    const guestFeedData = await guestFeedRes.json();
    const guestVn = guestFeedData.data.voiceNotes.find((vn) => vn.id === publicVnId);
    assert(
      guestVn && typeof guestVn.likeCount === 'number' && guestVn.likedByMe === false,
      'Test 48: Guest feed has likeCount but likedByMe = false'
    );

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 16 Engagement Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Test Error]', error);
    failed++;
  } finally {
    // Cleanup
    try {
      // Clean up stored audio files
      const audioDir = storageService.getStoragePath();
      const fs = require('fs');
      if (fs.existsSync(audioDir)) {
        const files = fs.readdirSync(audioDir);
        for (const file of files) {
          try {
            fs.unlinkSync(require('path').join(audioDir, file));
          } catch {}
        }
      }
    } catch {}

    if (server) {
      server.close();
    }
    await mongoose.connection.close();
    console.log('[Cleanup] Test server stopped and DB connection closed');
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
