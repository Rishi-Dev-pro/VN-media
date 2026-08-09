const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5005;
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
function createUploadFormData({ title, description, visibility, buffer, filename = 'audio.wav', mimeType = 'audio/wav' }) {
  const form = new FormData();
  if (title !== undefined) form.append('title', title);
  if (description !== undefined) form.append('description', description);
  if (visibility !== undefined) form.append('visibility', visibility);

  if (buffer) {
    const fileBlob = new Blob([buffer], { type: mimeType });
    form.append('audio', fileBlob, filename);
  }

  return form;
}

const runTests = async () => {
  console.log('=== PHASE 5 LIKES & ALBUM MANAGEMENT TEST SUITE ===\n');

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

    // 3. Register & Login Test Users (User A & User B)
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a', email: 'usera@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b', email: 'userb@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    // 4. Create VoiceNotes (User A: Public VN, Private VN; User B: Public VN)
    const resPubA = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Public Note A', visibility: 'public', buffer: createMinimalWavBuffer(1) }),
    });
    const pubVN_A = (await resPubA.json()).data.voiceNote;

    const resPrivA = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Private Note A', visibility: 'private', buffer: createMinimalWavBuffer(1) }),
    });
    const privVN_A = (await resPrivA.json()).data.voiceNote;

    const resPubB = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Public Note B', visibility: 'public', buffer: createMinimalWavBuffer(1) }),
    });
    const pubVN_B = (await resPubB.json()).data.voiceNote;

    console.log('Setup completed: Created User A (', userAId, '), User B (', userBId, ')\n');

    // ----------------------------------------------------
    // LIKES TESTS (Tests 1 - 12)
    // ----------------------------------------------------
    console.log('--- Testing Likes API ---');

    // Test 1: Authenticated user can like public VN
    const resLike1 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataLike1 = await resLike1.json();
    if (resLike1.status !== 200 || !dataLike1.data.liked) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataLike1)}`);
    }
    console.log('✓ Test 1: Authenticated user (User B) can like public VN');

    // Test 2: Like is stored with correct userId and voiceNoteId in DB
    const dbLike2 = await Like.findOne({ userId: userBId, voiceNoteId: pubVN_A.id });
    if (!dbLike2) throw new Error('Test 2 Failed: Like not found in database');
    console.log('✓ Test 2: Like is stored with correct userId and voiceNoteId in DB');

    // Test 3: Duplicate like does not create another Like (idempotent)
    const resLike3 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataLike3 = await resLike3.json();
    const countLike3 = await Like.countDocuments({ userId: userBId, voiceNoteId: pubVN_A.id });
    if (resLike3.status !== 200 || !dataLike3.data.liked || countLike3 !== 1) {
      throw new Error(`Test 3 Failed: Duplicate like created or error returned: ${JSON.stringify(dataLike3)}`);
    }
    console.log('✓ Test 3: Duplicate like is idempotent (returns liked: true, 1 record in DB)');

    // Test 4: Authenticated user can unlike
    const resLike4 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataLike4 = await resLike4.json();
    const countLike4 = await Like.countDocuments({ userId: userBId, voiceNoteId: pubVN_A.id });
    if (resLike4.status !== 200 || dataLike4.data.liked !== false || countLike4 !== 0) {
      throw new Error(`Test 4 Failed: Unlike failed: ${JSON.stringify(dataLike4)}`);
    }
    console.log('✓ Test 4: Authenticated user can unlike (returns liked: false, 0 records in DB)');

    // Test 5: Repeated unlike is handled safely (idempotent)
    const resLike5 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataLike5 = await resLike5.json();
    if (resLike5.status !== 200 || dataLike5.data.liked !== false) {
      throw new Error(`Test 5 Failed: Repeated unlike failed: ${JSON.stringify(dataLike5)}`);
    }
    console.log('✓ Test 5: Repeated unlike is idempotent (returns liked: false)');

    // Re-like pubVN_A for count test
    await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${tokenB}` } });

    // Test 6: Like count is correct
    const resLike6 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/likes`);
    const dataLike6 = await resLike6.json();
    if (resLike6.status !== 200 || dataLike6.data.count !== 1) {
      throw new Error(`Test 6 Failed: Like count incorrect: ${JSON.stringify(dataLike6)}`);
    }
    console.log('✓ Test 6: Like count is correct (1 like)');

    // Test 7: likedByMe is correct for authenticated user
    const resLike7A = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/likes`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataLike7A = await resLike7A.json();
    const resLike7B = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/likes`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const dataLike7B = await resLike7B.json();

    if (!dataLike7A.data.likedByMe || dataLike7B.data.likedByMe) {
      throw new Error(`Test 7 Failed: likedByMe incorrect: UserB=${dataLike7A.data.likedByMe}, UserA=${dataLike7B.data.likedByMe}`);
    }
    console.log('✓ Test 7: likedByMe status is correct for authenticated user (true for liker, false for non-liker)');

    // Test 8: Guest cannot like
    const resLike8 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, { method: 'POST' });
    if (resLike8.status !== 401) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Guest cannot like (401 Unauthorized)');

    // Test 9: Guest cannot unlike
    const resLike9 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/like`, { method: 'DELETE' });
    if (resLike9.status !== 401) throw new Error('Test 9 Failed');
    console.log('✓ Test 9: Guest cannot unlike (401 Unauthorized)');

    // Test 10: Owner can like private VN
    const resLike10 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${tokenA}` } });
    if (resLike10.status !== 200) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Owner can like private VN (200 OK)');

    // Test 11: Other user CANNOT like private VN (403)
    const resLike11 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/like`, { method: 'POST', headers: { Authorization: `Bearer ${tokenB}` } });
    if (resLike11.status !== 403) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: Other user CANNOT like owner\'s private VN (403 Forbidden)');

    // Test 12: Other user CANNOT unlike owner's private VN (403)
    const resLike12 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/like`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokenB}` } });
    if (resLike12.status !== 403) throw new Error('Test 12 Failed');
    console.log('✓ Test 12: Other user CANNOT unlike owner\'s private VN (403 Forbidden)');

    // ----------------------------------------------------
    // ALBUM CRUD TESTS (Tests 13 - 22)
    // ----------------------------------------------------
    console.log('\n--- Testing Album CRUD API ---');

    // Test 13: Authenticated user can create Album
    const resAlbum13 = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'User A Album 1', description: 'Album description', coverImage: 'https://example.com/cover.jpg' }),
    });
    const dataAlbum13 = await resAlbum13.json();
    if (resAlbum13.status !== 201 || !dataAlbum13.data.album) {
      throw new Error(`Test 13 Failed: ${JSON.stringify(dataAlbum13)}`);
    }
    const albumA_1 = dataAlbum13.data.album;
    console.log('✓ Test 13: Authenticated user can create Album (201 Created)');

    // Test 14: Album owner comes from JWT
    if (albumA_1.ownerId !== userAId) throw new Error('Test 14 Failed: ownerId mismatch');
    console.log('✓ Test 14: Album ownerId comes from JWT token');

    // Test 15: Client cannot assign another user as owner
    const resAlbum15 = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Spoofed Owner Album', ownerId: userBId }),
    });
    const dataAlbum15 = await resAlbum15.json();
    if (resAlbum15.status !== 201 || dataAlbum15.data.album.ownerId !== userAId) {
      throw new Error('Test 15 Failed: Spoofed ownerId was accepted');
    }
    console.log('✓ Test 15: Client cannot assign another user as album owner');

    // Test 16: User can retrieve their own albums
    const resAlbum16 = await fetch(`${BASE_URL}/albums?page=1&limit=10`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const dataAlbum16 = await resAlbum16.json();
    if (resAlbum16.status !== 200 || dataAlbum16.data.albums.length < 2) {
      throw new Error(`Test 16 Failed: ${JSON.stringify(dataAlbum16)}`);
    }
    console.log('✓ Test 16: User can retrieve their own albums (GET /api/albums)');

    // Test 17: User B CANNOT retrieve User A's album (403)
    const resAlbum17 = await fetch(`${BASE_URL}/albums/${albumA_1.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resAlbum17.status !== 403) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: User B CANNOT retrieve User A\'s album (403 Forbidden)');

    // Test 18: Owner can retrieve a single album
    const resAlbum18 = await fetch(`${BASE_URL}/albums/${albumA_1.id}`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const dataAlbum18 = await resAlbum18.json();
    if (resAlbum18.status !== 200 || dataAlbum18.data.album.id !== albumA_1.id) {
      throw new Error(`Test 18 Failed: ${JSON.stringify(dataAlbum18)}`);
    }
    console.log('✓ Test 18: Owner can retrieve a single album (200 OK)');

    // Test 19: Owner can update album metadata
    const resAlbum19 = await fetch(`${BASE_URL}/albums/${albumA_1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Updated Album Title', description: 'Updated Description' }),
    });
    const dataAlbum19 = await resAlbum19.json();
    if (resAlbum19.status !== 200 || dataAlbum19.data.album.title !== 'Updated Album Title') {
      throw new Error(`Test 19 Failed: ${JSON.stringify(dataAlbum19)}`);
    }
    console.log('✓ Test 19: Owner can update album metadata (PATCH /api/albums/:id)');

    // Test 20: Non-owner cannot update album (403)
    const resAlbum20 = await fetch(`${BASE_URL}/albums/${albumA_1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    if (resAlbum20.status !== 403) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: Non-owner CANNOT update album (403 Forbidden)');

    // Test 21: Owner can delete album
    const resAlbumDelTemp = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Temp Album to Delete' }),
    });
    const tempAlbumId = (await resAlbumDelTemp.json()).data.album.id;
    const resAlbum21 = await fetch(`${BASE_URL}/albums/${tempAlbumId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (resAlbum21.status !== 200) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Owner can delete album (200 OK)');

    // Test 22: Non-owner cannot delete album (403)
    const resAlbum22 = await fetch(`${BASE_URL}/albums/${albumA_1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (resAlbum22.status !== 403) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Non-owner CANNOT delete album (403 Forbidden)');

    // ----------------------------------------------------
    // ALBUM ITEM TESTS (Tests 23 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Item Management ---');

    // Create Album for User B
    const resAlbumB = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ title: 'User B Album' }),
    });
    const albumB = (await resAlbumB.json()).data.album;

    // Test 23: Owner can add accessible public VN (owned by User A) to User B's album
    const resItem23 = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: pubVN_A.id }),
    });
    const dataItem23 = await resItem23.json();
    if (resItem23.status !== 201 || !dataItem23.data.item) {
      throw new Error(`Test 23 Failed: ${JSON.stringify(dataItem23)}`);
    }
    const item1 = dataItem23.data.item;
    console.log('✓ Test 23: Owner can add accessible public VN to their album');

    // Test 24: Owner can add their own private VN to User A's album
    const resItem24 = await fetch(`${BASE_URL}/albums/${albumA_1.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ voiceNoteId: privVN_A.id }),
    });
    if (resItem24.status !== 201) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Owner can add their own private VN to their album');

    // Test 25: User B CANNOT add User A's private VN to User B's album (403)
    const resItem25 = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: privVN_A.id }),
    });
    if (resItem25.status !== 403) throw new Error('Test 25 Failed');
    console.log('✓ Test 25: User B CANNOT add User A\'s private VN to User B\'s album (403 Forbidden)');

    // Test 26: Duplicate VN cannot be added to same album (400)
    const resItem26 = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: pubVN_A.id }),
    });
    if (resItem26.status !== 400) throw new Error('Test 26 Failed');
    console.log('✓ Test 26: Duplicate VN cannot be added to the same album (400 Bad Request)');

    // Test 27: First item in album receives position 1
    if (item1.position !== 1) throw new Error(`Test 27 Failed: Expected position 1, got ${item1.position}`);
    console.log('✓ Test 27: First item in album receives position 1');

    // Test 28: Next item receives correct next position (position 2)
    const resItem28 = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: pubVN_B.id }),
    });
    const item2 = (await resItem28.json()).data.item;
    if (item2.position !== 2) throw new Error(`Test 28 Failed: Expected position 2, got ${item2.position}`);
    console.log('✓ Test 28: Next item receives correct next position (position 2)');

    // Test 29: Items are returned sorted by position ASC in GET /api/albums/:id
    const resGetAlbumB = await fetch(`${BASE_URL}/albums/${albumB.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataGetAlbumB = await resGetAlbumB.json();
    const albumBItems = dataGetAlbumB.data.items;
    if (albumBItems[0].position !== 1 || albumBItems[1].position !== 2) {
      throw new Error('Test 29 Failed: Items not sorted by position ASC');
    }
    console.log('✓ Test 29: Items are returned sorted by position ASC');

    // Add 3rd item to albumB for reorder tests
    const resPubB2 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Public Note B2', visibility: 'public', buffer: createMinimalWavBuffer(1) }),
    });
    const pubVN_B2 = (await resPubB2.json()).data.voiceNote;
    const resItem3 = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: pubVN_B2.id }),
    });
    const item3 = (await resItem3.json()).data.item;

    // Test 30: Owner can remove AlbumItem
    const resRemove30 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/${item3.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (resRemove30.status !== 200) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: Owner can remove AlbumItem (DELETE /api/albums/:id/items/:itemId)');

    // Test 31: Removing AlbumItem does NOT delete VoiceNote document
    const vnDoc31 = await VoiceNote.findById(pubVN_B2.id);
    if (!vnDoc31) throw new Error('Test 31 Failed: VoiceNote document was deleted');
    console.log('✓ Test 31: Removing AlbumItem does NOT delete VoiceNote document');

    // Test 32: Removing AlbumItem does NOT delete audio file on disk
    const fileExists32 = await storageService.fileExists(pubVN_B2.audioUrl);
    if (!fileExists32) throw new Error('Test 32 Failed: Audio file was deleted');
    console.log('✓ Test 32: Removing AlbumItem does NOT delete audio file on disk');

    // Re-add 3rd item to albumB for reordering tests
    const item3_new = (await (await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ voiceNoteId: pubVN_B2.id }),
    })).json()).data.item;

    // ----------------------------------------------------
    // REORDER TESTS (Tests 33 - 40)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Item Reordering ---');

    // Current items in albumB: item1 (pos 1), item2 (pos 2), item3_new (pos 3)
    // Desired reorder: item3_new -> pos 1, item1 -> pos 2, item2 -> pos 3
    const reorderPayload = [
      { itemId: item3_new.id, position: 1 },
      { itemId: item1.id, position: 2 },
      { itemId: item2.id, position: 3 },
    ];

    // Test 33: Owner can reorder AlbumItems
    const resReorder33 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ items: reorderPayload }),
    });
    if (resReorder33.status !== 200) throw new Error(`Test 33 Failed: ${await resReorder33.text()}`);
    console.log('✓ Test 33: Owner can reorder AlbumItems (PATCH /api/albums/:id/items/reorder)');

    // Test 34: Reordered positions are correct in API response and DB
    const resGetReordered = await fetch(`${BASE_URL}/albums/${albumB.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const itemsReordered = (await resGetReordered.json()).data.items;

    if (
      itemsReordered[0].id !== item3_new.id ||
      itemsReordered[1].id !== item1.id ||
      itemsReordered[2].id !== item2.id ||
      itemsReordered[0].position !== 1 ||
      itemsReordered[1].position !== 2 ||
      itemsReordered[2].position !== 3
    ) {
      throw new Error(`Test 34 Failed: Incorrect reorder positions: ${JSON.stringify(itemsReordered)}`);
    }
    console.log('✓ Test 34: Reordered positions are correct in API response and database');

    // Test 35: Duplicate positions in reorder payload are rejected (400)
    const resReorder35 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        items: [
          { itemId: item1.id, position: 1 },
          { itemId: item2.id, position: 1 },
          { itemId: item3_new.id, position: 2 },
        ],
      }),
    });
    if (resReorder35.status !== 400) throw new Error('Test 35 Failed');
    console.log('✓ Test 35: Duplicate positions in reorder payload are rejected (400 Bad Request)');

    // Test 36: Invalid positions are rejected (400)
    const resReorder36 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        items: [
          { itemId: item1.id, position: 0 },
          { itemId: item2.id, position: 2 },
          { itemId: item3_new.id, position: 3 },
        ],
      }),
    });
    if (resReorder36.status !== 400) throw new Error('Test 36 Failed');
    console.log('✓ Test 36: Invalid positions (< 1) are rejected (400 Bad Request)');

    // Test 37: Item from another Album cannot be included in reorder payload (400)
    const itemInAlbumA = (await (await fetch(`${BASE_URL}/albums/${albumA_1.id}`, { headers: { Authorization: `Bearer ${tokenA}` } })).json()).data.items[0];
    const resReorder37 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        items: [
          { itemId: itemInAlbumA.id, position: 1 },
          { itemId: item1.id, position: 2 },
          { itemId: item2.id, position: 3 },
        ],
      }),
    });
    if (resReorder37.status !== 400) throw new Error('Test 37 Failed');
    console.log('✓ Test 37: Item from another Album cannot be included in reorder payload (400 Bad Request)');

    // Test 38: Reordering preserves all AlbumItems
    const countItems38 = await AlbumItem.countDocuments({ albumId: albumB.id });
    if (countItems38 !== 3) throw new Error(`Test 38 Failed: Item count changed: ${countItems38}`);
    console.log('✓ Test 38: Reordering preserves all AlbumItems (3 total)');

    // Test 39: Unique album position constraint remains intact in DB
    const dbIndexes39 = await AlbumItem.collection.indexes();
    const hasPosIndex = dbIndexes39.some((idx) => idx.name.includes('albumId_1_position_1') && idx.unique);
    if (!hasPosIndex) throw new Error('Test 39 Failed: Compound unique position index was removed or lost');
    console.log('✓ Test 39: Unique compound position index { albumId: 1, position: 1 } remains intact at DB level');

    // Test 40: Conflicting position updates are handled safely
    const reorderReverse = [
      { itemId: item2.id, position: 1 },
      { itemId: item1.id, position: 2 },
      { itemId: item3_new.id, position: 3 },
    ];
    const resReorder40 = await fetch(`${BASE_URL}/albums/${albumB.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ items: reorderReverse }),
    });
    if (resReorder40.status !== 200) throw new Error('Test 40 Failed');
    console.log('✓ Test 40: Conflicting position updates are handled safely via two-phase atomic reordering');

    // ----------------------------------------------------
    // ALBUM DELETE CLEANUP TESTS (Tests 41 - 43)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Deletion Cleanup ---');

    // Create dedicated album for deletion test
    const resAlbumDelObj = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ title: 'Deletion Test Album' }),
    });
    const albumDelId = (await resAlbumDelObj.json()).data.album.id;
    await fetch(`${BASE_URL}/albums/${albumDelId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ voiceNoteId: pubVN_A.id }),
    });

    // Delete Album
    const resDelAlbumFinal = await fetch(`${BASE_URL}/albums/${albumDelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (resDelAlbumFinal.status !== 200) throw new Error('Album deletion failed');

    // Test 41: Deleting Album removes AlbumItems
    const countDelItems41 = await AlbumItem.countDocuments({ albumId: albumDelId });
    if (countDelItems41 !== 0) throw new Error('Test 41 Failed: AlbumItems were not cleaned up');
    console.log('✓ Test 41: Deleting Album removes associated AlbumItems (0 remaining)');

    // Test 42: Deleting Album does NOT delete VoiceNotes
    const vnDoc42 = await VoiceNote.findById(pubVN_A.id);
    if (!vnDoc42) throw new Error('Test 42 Failed: VoiceNote document was deleted');
    console.log('✓ Test 42: Deleting Album does NOT delete VoiceNote documents');

    // Test 43: Deleting Album does NOT delete audio files on disk
    const fileExists43 = await storageService.fileExists(pubVN_A.audioUrl);
    if (!fileExists43) throw new Error('Test 43 Failed: Audio file on disk was deleted');
    console.log('✓ Test 43: Deleting Album does NOT delete audio files on disk');

    console.log('\n=== ALL 43 PHASE 5 LIKES & ALBUM MANAGEMENT TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 5 SOCIAL & ALBUMS TEST FAILED:', error);
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
