const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5007;
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
  console.log('=== PHASE 7 USER PROFILES & PUBLIC CREATOR PAGES TEST SUITE ===\n');

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
    console.log('[Test DB] Cleared test DB and synced indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login Test Users
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'creator_a', email: 'creatora@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creatora@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'listener_b', email: 'listenerb@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'listenerb@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;

    // Set bio and avatar for creator_a
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bio: 'Voice creator bio', avatar: 'https://example.com/avatar.jpg' }),
    });

    // 4. Create VoiceNotes for User A (2 Public VNs, 2 Private VNs) and Private Album
    const resPub1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'College Memories', visibility: 'public', tags: ['college', 'memories'], buffer: createMinimalWavBuffer(1) }),
    });
    const pubVN1 = (await resPub1.json()).data.voiceNote;

    const resPub2 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Morning Thoughts', visibility: 'public', tags: ['morning'], buffer: createMinimalWavBuffer(1) }),
    });
    const pubVN2 = (await resPub2.json()).data.voiceNote;

    const resPriv1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Secret Recording 1', visibility: 'private', tags: ['secret'], buffer: createMinimalWavBuffer(1) }),
    });
    const privVN1 = (await resPriv1.json()).data.voiceNote;

    await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Secret Recording 2', visibility: 'private', tags: ['secret'], buffer: createMinimalWavBuffer(1) }),
    });

    // Create Private Album for User A
    const resAlbum = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Private Collection A' }),
    });
    const albumA = (await resAlbum.json()).data.album;

    // User B likes User A's Public VN 1
    await fetch(`${BASE_URL}/vns/${pubVN1.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${tokenB}` } });

    console.log('Setup completed: Created Creator A (', userAId, ') with 2 Public VNs, 2 Private VNs, 1 Album\n');

    // ----------------------------------------------------
    // PUBLIC PROFILE TESTS (Tests 1 - 10)
    // ----------------------------------------------------
    console.log('--- Testing Public User Profiles (GET /api/users/:username) ---');

    // Test 1: Guest can retrieve public profile
    const resProfile1 = await fetch(`${BASE_URL}/users/creator_a`);
    const dataProfile1 = await resProfile1.json();
    if (resProfile1.status !== 200 || !dataProfile1.data.user || !dataProfile1.data.stats) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataProfile1)}`);
    }
    console.log('✓ Test 1: Unauthenticated guest can retrieve public profile (200 OK)');

    // Test 2: Authenticated User B can retrieve User A's public profile
    const resProfile2 = await fetch(`${BASE_URL}/users/creator_a`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resProfile2.status !== 200) throw new Error('Test 2 Failed');
    console.log('✓ Test 2: Authenticated User B can retrieve User A\'s public profile');

    // Test 3: User A can retrieve their own public profile
    const resProfile3 = await fetch(`${BASE_URL}/users/creator_a`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resProfile3.status !== 200) throw new Error('Test 3 Failed');
    console.log('✓ Test 3: User A can retrieve their own public profile');

    // Test 4: Nonexistent username returns 404 Not Found
    const resProfile4 = await fetch(`${BASE_URL}/users/nonexistent_user_999`);
    if (resProfile4.status !== 404) throw new Error('Test 4 Failed');
    console.log('✓ Test 4: Nonexistent username returns 404 Not Found');

    // Test 5: Profile response contains username
    const profileUser = dataProfile1.data.user;
    if (profileUser.username !== 'creator_a') throw new Error('Test 5 Failed');
    console.log('✓ Test 5: Profile response contains username');

    // Test 6: Profile response contains avatar
    if (profileUser.avatar !== 'https://example.com/avatar.jpg') throw new Error('Test 6 Failed');
    console.log('✓ Test 6: Profile response contains avatar');

    // Test 7: Profile response contains bio
    if (profileUser.bio !== 'Voice creator bio') throw new Error('Test 7 Failed');
    console.log('✓ Test 7: Profile response contains bio');

    // Test 8: Profile response contains createdAt
    if (!profileUser.createdAt) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Profile response contains createdAt');

    // Test 9: Profile response does NOT contain email
    if (profileUser.email !== undefined) throw new Error('Test 9 Failed: email exposed in public profile');
    console.log('✓ Test 9: Profile response does NOT contain email');

    // Test 10: Profile response does NOT contain passwordHash
    if (profileUser.passwordHash !== undefined) throw new Error('Test 10 Failed: passwordHash exposed in public profile');
    console.log('✓ Test 10: Profile response does NOT contain passwordHash');

    // ----------------------------------------------------
    // PUBLIC CREATOR VOICENOTES TESTS (Tests 11 - 18)
    // ----------------------------------------------------
    console.log('\n--- Testing Public Creator VoiceNotes (GET /api/users/:username/voice-notes) ---');

    // Test 11: GET /api/users/:username/voice-notes returns User A's public VoiceNotes
    const resCreatorVns11 = await fetch(`${BASE_URL}/users/creator_a/voice-notes`);
    const dataCreatorVns11 = await resCreatorVns11.json();
    if (resCreatorVns11.status !== 200 || dataCreatorVns11.data.voiceNotes.length !== 2) {
      throw new Error(`Test 11 Failed: ${JSON.stringify(dataCreatorVns11)}`);
    }
    console.log('✓ Test 11: GET /api/users/:username/voice-notes returns User A\'s public VoiceNotes (2 total)');

    // Test 12: User A's private VoiceNotes are NOT returned
    const returnedVnIds = dataCreatorVns11.data.voiceNotes.map((v) => v.id);
    if (returnedVnIds.includes(privVN1.id)) throw new Error('Test 12 Failed: Private VN returned in public creator listing');
    console.log('✓ Test 12: User A\'s private VoiceNotes are NOT returned');

    // Test 13: Private VoiceNotes are excluded from pagination total count
    if (dataCreatorVns11.data.pagination.total !== 2) throw new Error(`Test 13 Failed: Total count included private VNs: ${dataCreatorVns11.data.pagination.total}`);
    console.log('✓ Test 13: Private VoiceNotes are excluded from pagination total count (total = 2)');

    // Test 14: Private VoiceNotes are excluded from pagination items array
    if (dataCreatorVns11.data.voiceNotes.some((v) => v.visibility === 'private')) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Private VoiceNotes are excluded from pagination items array');

    // Test 15: Public VoiceNotes are sorted deterministically (createdAt DESC)
    const creatorVns = dataCreatorVns11.data.voiceNotes;
    if (new Date(creatorVns[0].createdAt) < new Date(creatorVns[1].createdAt)) {
      throw new Error('Test 15 Failed: Creator VoiceNotes not sorted by createdAt DESC');
    }
    console.log('✓ Test 15: Public VoiceNotes are sorted deterministically (createdAt DESC)');

    // Test 16: Pagination works (?page=1&limit=1)
    const resPag16 = await fetch(`${BASE_URL}/users/creator_a/voice-notes?page=1&limit=1`);
    const dataPag16 = await resPag16.json();
    if (dataPag16.data.voiceNotes.length !== 1 || dataPag16.data.pagination.limit !== 1) {
      throw new Error('Test 16 Failed');
    }
    console.log('✓ Test 16: Pagination works (page 1, limit 1)');

    // Test 17: Excessive limit is constrained (capped at 100)
    const resPag17 = await fetch(`${BASE_URL}/users/creator_a/voice-notes?limit=999999`);
    const dataPag17 = await resPag17.json();
    if (dataPag17.data.pagination.limit > 100) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: Excessive limit is constrained (capped at 100)');

    // Test 18: Invalid pagination params are handled safely
    const resPag18 = await fetch(`${BASE_URL}/users/creator_a/voice-notes?page=invalid&limit=abc`);
    const dataPag18 = await resPag18.json();
    if (dataPag18.data.pagination.page !== 1 || dataPag18.data.pagination.limit !== 20) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: Invalid pagination parameters are handled safely');

    // ----------------------------------------------------
    // PROFILE PRIVACY TESTS (Tests 19 - 25)
    // ----------------------------------------------------
    console.log('\n--- Testing Profile Privacy Boundaries ---');

    // Test 19: Guest cannot discover private VoiceNotes through profile endpoints
    const rawProfileGuest = JSON.stringify(dataProfile1);
    const rawVnsGuest = JSON.stringify(dataCreatorVns11);
    if (rawProfileGuest.includes(privVN1.title) || rawVnsGuest.includes(privVN1.title)) {
      throw new Error('Test 19 Failed: Guest discovered private VN title');
    }
    console.log('✓ Test 19: Guest cannot discover private VoiceNotes through profile endpoints');

    // Test 20: Other user cannot discover private VoiceNotes through profile endpoints
    const resProfUserB = await fetch(`${BASE_URL}/users/creator_a`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const resVnsUserB = await fetch(`${BASE_URL}/users/creator_a/voice-notes`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const rawProfUserB = JSON.stringify(await resProfUserB.json());
    const rawVnsUserB = JSON.stringify(await resVnsUserB.json());

    if (rawProfUserB.includes(privVN1.title) || rawVnsUserB.includes(privVN1.title)) {
      throw new Error('Test 20 Failed: User B discovered private VN title');
    }
    console.log('✓ Test 20: Other user (User B) cannot discover private VoiceNotes through profile endpoints');

    // Test 21: Private VoiceNote titles are not leaked
    if (rawVnsGuest.includes('Secret Recording')) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Private VoiceNote titles are not leaked');

    // Test 22: Private VoiceNote IDs are not leaked
    if (rawVnsGuest.includes(privVN1.id)) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Private VoiceNote IDs are not leaked');

    // Test 23: Private VoiceNote counts are not leaked (stats.publicVoiceNotes = 2)
    if (dataProfile1.data.stats.publicVoiceNotes !== 2) {
      throw new Error(`Test 23 Failed: stats.publicVoiceNotes leaked private count: ${dataProfile1.data.stats.publicVoiceNotes}`);
    }
    console.log('✓ Test 23: Private VoiceNote counts are not leaked (stats.publicVoiceNotes = 2)');

    // Test 24: Private Album metadata is not exposed on public profile endpoints
    if (rawProfileGuest.includes(albumA.title) || rawVnsGuest.includes(albumA.title)) {
      throw new Error('Test 24 Failed: Private album metadata leaked');
    }
    console.log('✓ Test 24: Private Album metadata is not exposed on public profile endpoints');

    // Test 25: Private Album contents are not exposed on public profile endpoints
    if (rawProfileGuest.includes(albumA.id) || rawVnsGuest.includes(albumA.id)) {
      throw new Error('Test 25 Failed: Private album ID leaked');
    }
    console.log('✓ Test 25: Private Album contents are not exposed on public profile endpoints');

    // ----------------------------------------------------
    // PROFILE UPDATE REGRESSION TESTS (Tests 26 - 33)
    // ----------------------------------------------------
    console.log('\n--- Testing Profile Update & Regression Safety ---');

    // Test 26: Authenticated user can update username via PATCH /api/users/me
    const resUpdate26 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ username: 'creator_a_updated' }),
    });
    const dataUpdate26 = await resUpdate26.json();
    if (resUpdate26.status !== 200 || dataUpdate26.data.user.username !== 'creator_a_updated') {
      throw new Error(`Test 26 Failed: ${JSON.stringify(dataUpdate26)}`);
    }
    console.log('✓ Test 26: Authenticated user can update username (PATCH /api/users/me)');

    // Test 27: Authenticated user can update avatar
    const resUpdate27 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ avatar: 'https://example.com/new_avatar.png' }),
    });
    if ((await resUpdate27.json()).data.user.avatar !== 'https://example.com/new_avatar.png') throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Authenticated user can update avatar');

    // Test 28: Authenticated user can update bio
    const resUpdate28 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bio: 'Updated creator bio' }),
    });
    if ((await resUpdate28.json()).data.user.bio !== 'Updated creator bio') throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Authenticated user can update bio');

    // Test 29: Unauthenticated user cannot update profile (401)
    const resUpdate29 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Hacked bio' }),
    });
    if (resUpdate29.status !== 401) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Unauthenticated user cannot update profile (401 Unauthorized)');

    // Test 30: User cannot update another user's profile via public endpoint (no edit route on /:username)
    const resUpdate30 = await fetch(`${BASE_URL}/users/listener_b`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ bio: 'Hacked bio' }),
    });
    // Should return 404 or 405 (route not matched for PATCH on /:username)
    if (resUpdate30.status !== 404) throw new Error(`Test 30 Failed: Expected 404, got ${resUpdate30.status}`);
    console.log('✓ Test 30: User cannot update another user\'s profile via public endpoints');

    // Test 31: email cannot be modified through PATCH /api/users/me
    const resUpdate31 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ email: 'hacked_email@example.com' }),
    });
    const userDoc31 = await User.findById(userAId);
    if (userDoc31.email !== 'creatora@example.com') throw new Error('Test 31 Failed: email was modified');
    console.log('✓ Test 31: email cannot be modified through profile update endpoint');

    // Test 32: passwordHash cannot be modified through PATCH /api/users/me
    const oldHash32 = userDoc31.passwordHash;
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ passwordHash: 'hacked_hash' }),
    });
    const userDoc32 = await User.findById(userAId);
    if (userDoc32.passwordHash !== oldHash32) throw new Error('Test 32 Failed: passwordHash was modified');
    console.log('✓ Test 32: passwordHash cannot be modified through profile update endpoint');

    // Test 33: Username uniqueness is preserved
    const resUpdate33 = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ username: 'listener_b' }),
    });
    if (resUpdate33.status !== 400) throw new Error('Test 33 Failed: Duplicate username allowed');
    console.log('✓ Test 33: Username uniqueness is preserved (400 Bad Request)');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 34 - 39)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Change & Relationship Integrity ---');

    // Current username of User A: creator_a_updated
    // Test 34: GET /api/users/creator_a_updated works after username change
    const resProf34 = await fetch(`${BASE_URL}/users/creator_a_updated`);
    if (resProf34.status !== 200) throw new Error('Test 34 Failed');
    console.log('✓ Test 34: GET /api/users/creator_a_updated works after username change');

    // Test 35: Old username (creator_a) no longer resolves (404)
    const resProf35 = await fetch(`${BASE_URL}/users/creator_a`);
    if (resProf35.status !== 404) throw new Error('Test 35 Failed');
    console.log('✓ Test 35: Old username (creator_a) no longer resolves (404 Not Found)');

    // Test 36: VoiceNote ownership (ownerId) still references the same User _id
    const vnDoc36 = await VoiceNote.findById(pubVN1.id);
    if (vnDoc36.ownerId.toString() !== userAId) throw new Error('Test 36 Failed: VoiceNote ownerId broken');
    console.log('✓ Test 36: VoiceNote ownership (ownerId) still references the same User _id');

    // Test 37: User's public VoiceNotes remain associated with user after username change
    const resVns37 = await fetch(`${BASE_URL}/users/creator_a_updated/voice-notes`);
    const dataVns37 = await resVns37.json();
    if (resVns37.status !== 200 || dataVns37.data.voiceNotes.length !== 2) throw new Error('Test 37 Failed');
    console.log('✓ Test 37: User\'s public VoiceNotes remain associated with user under new username');

    // Test 38: Albums remain owned by the same User _id
    const albumDoc38 = await Album.findById(albumA.id);
    if (albumDoc38.ownerId.toString() !== userAId) throw new Error('Test 38 Failed: Album ownerId broken');
    console.log('✓ Test 38: Albums remain owned by the same User _id');

    // Test 39: Existing Likes remain intact
    const likeDoc39 = await Like.findOne({ voiceNoteId: pubVN1.id });
    if (!likeDoc39) throw new Error('Test 39 Failed: Like document missing');
    console.log('✓ Test 39: Existing Likes remain intact after username change');

    // ----------------------------------------------------
    // PROFILE CONTENT CONSISTENCY TESTS (Tests 40 - 42)
    // ----------------------------------------------------
    console.log('\n--- Testing Profile Content Consistency ---');

    // Test 40: Public VN appears in both profile VoiceNotes and feed
    const resFeed40 = await fetch(`${BASE_URL}/vns/feed`);
    const feedVnIds = (await resFeed40.json()).data.voiceNotes.map((v) => v.id);
    const creatorVnIds = dataVns37.data.voiceNotes.map((v) => v.id);

    if (!feedVnIds.includes(pubVN1.id) || !creatorVnIds.includes(pubVN1.id)) {
      throw new Error('Test 40 Failed: Public VN missing from feed or creator profile');
    }
    console.log('✓ Test 40: Public VN appears in both creator profile VoiceNotes and public feed');

    // Test 41: Private VN does NOT appear in profile VoiceNotes, feed, search, or tag discovery
    const resSearch41 = await fetch(`${BASE_URL}/vns/search?q=Secret`);
    const resTag41 = await fetch(`${BASE_URL}/vns/tags/secret`);
    const searchVnIds = (await resSearch41.json()).data.items.map((v) => v.id);
    const tagVnIds = (await resTag41.json()).data.items.map((v) => v.id);

    if (
      creatorVnIds.includes(privVN1.id) ||
      feedVnIds.includes(privVN1.id) ||
      searchVnIds.includes(privVN1.id) ||
      tagVnIds.includes(privVN1.id)
    ) {
      throw new Error('Test 41 Failed: Private VN leaked in public discovery endpoints');
    }
    console.log('✓ Test 41: Private VN does NOT appear in creator profile, feed, search, or tag discovery');

    // Test 42: Public profile statistics count ONLY public VoiceNotes
    const resProf42 = await fetch(`${BASE_URL}/users/creator_a_updated`);
    const dataProf42 = await resProf42.json();
    if (dataProf42.data.stats.publicVoiceNotes !== 2) {
      throw new Error(`Test 42 Failed: Incorrect publicVoiceNotes count: ${dataProf42.data.stats.publicVoiceNotes}`);
    }
    console.log('✓ Test 42: Public profile statistics count ONLY public VoiceNotes (publicVoiceNotes = 2)');

    console.log('\n=== ALL 42 PHASE 7 USER PROFILES & CREATOR PAGES TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 7 PROFILES TEST FAILED:', error);
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
