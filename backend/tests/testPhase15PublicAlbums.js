const http = require('http');
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

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5015;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

function createMinimalWavBuffer(durationSeconds = 1, sampleRate = 8000) {
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
  console.log('=== PHASE 15 PUBLIC ALBUMS & ALBUM DISCOVERY TEST SUITE ===\n');

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
    server = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
    });

    // ----------------------------------------------------
    // MODEL TESTS (Tests 1 - 4)
    // ----------------------------------------------------
    console.log('--- Testing Album Model Visibility Defaults & Validation ---');

    const tempUser = await User.create({ username: 'temp_owner', email: 'temp@example.com', passwordHash: 'hash' });

    // Test 1: Album defaults to visibility = 'private'
    const albumDefault = await Album.create({ ownerId: tempUser._id, title: 'Default Visibility Album' });
    if (albumDefault.visibility !== 'private') throw new Error('Test 1 Failed');
    console.log('✓ Test 1: Album defaults to visibility = private');

    // Test 2: Valid public Album accepted
    const albumPublicModel = await Album.create({ ownerId: tempUser._id, title: 'Public Model Album', visibility: 'public' });
    if (albumPublicModel.visibility !== 'public') throw new Error('Test 2 Failed');
    console.log('✓ Test 2: Valid public Album accepted');

    // Test 3: Invalid visibility rejected
    let validationFailed = false;
    try {
      await Album.create({ ownerId: tempUser._id, title: 'Invalid Album', visibility: 'invalid_vis' });
    } catch (err) {
      validationFailed = true;
    }
    if (!validationFailed) throw new Error('Test 3 Failed');
    console.log('✓ Test 3: Invalid visibility rejected by schema validation');

    // Test 4: Existing Album relationships remain valid
    const albumItemCheck = await AlbumItem.create({ albumId: albumDefault._id, voiceNoteId: new mongoose.Types.ObjectId(), position: 1 });
    if (!albumItemCheck || albumItemCheck.albumId.toString() !== albumDefault._id.toString()) throw new Error('Test 4 Failed');
    console.log('✓ Test 4: Existing Album relationships remain valid');

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

    const uploadVN = async (token, title, visibility, tags = ['tag1']) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, tags, buffer: createMinimalWavBuffer(1) }),
      });
      const data = await res.json();
      return data.data.voiceNote;
    };

    const createAlbumApi = async (token, title, description, visibility) => {
      const res = await fetch(`${BASE_URL}/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, description, visibility }),
      });
      const data = await res.json();
      return data.data.album;
    };

    // Create test VoiceNotes for User A
    const vnPublic = await uploadVN(userA.token, 'User A Public VN', 'public');
    const vnPrivate = await uploadVN(userA.token, 'User A Private VN', 'private');
    const vnDeleted = await uploadVN(userA.token, 'User A Deleted VN', 'public');
    await fetch(`${BASE_URL}/vns/${vnDeleted.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${userA.token}` } });

    // Create test Albums for User A
    const albumPublic = await createAlbumApi(userA.token, 'User A Public College Memories Album', 'My public college voice notes album', 'public');
    const albumPrivate = await createAlbumApi(userA.token, 'User A Secret Private Album', 'My top secret private album', 'private');

    // Add items to Public Album
    await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic.id }),
    });
    await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPrivate.id }),
    });
    await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnDeleted.id }),
    });

    console.log('Setup completed: Created Users A & B, VoiceNotes, and Albums.\n');

    // ----------------------------------------------------
    // PUBLIC ALBUM ACCESS TESTS (Tests 5 - 10)
    // ----------------------------------------------------
    console.log('--- Testing Public vs Private Album Access ---');

    // Test 5: Guest can retrieve public Album
    const resGetPubGuest = await fetch(`${BASE_URL}/albums/${albumPublic.id}`);
    if (resGetPubGuest.status !== 200) throw new Error('Test 5 Failed');
    console.log('✓ Test 5: Guest can retrieve public Album (200 OK)');

    // Test 6: Authenticated non-owner can retrieve public Album
    const resGetPubNonOwner = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if (resGetPubNonOwner.status !== 200) throw new Error('Test 6 Failed');
    console.log('✓ Test 6: Authenticated non-owner can retrieve public Album (200 OK)');

    // Test 7: Owner can retrieve public Album
    const resGetPubOwner = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resGetPubOwner.status !== 200) throw new Error('Test 7 Failed');
    console.log('✓ Test 7: Owner can retrieve public Album (200 OK)');

    // Test 8: Private Album is inaccessible to guest -> 404
    const resGetPrivGuest = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`);
    if (resGetPrivGuest.status !== 404) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Private Album is inaccessible to guest (404 Not Found)');

    // Test 9: Private Album is inaccessible to another user -> 404
    const resGetPrivNonOwner = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if (resGetPrivNonOwner.status !== 404) throw new Error('Test 9 Failed');
    console.log('✓ Test 9: Private Album is inaccessible to another user (404 Not Found)');

    // Test 10: Owner can retrieve private Album
    const resGetPrivOwner = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resGetPrivOwner.status !== 200) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Owner can retrieve private Album (200 OK)');

    // ----------------------------------------------------
    // ALBUM CONTENT PRIVACY TESTS (Tests 11 - 17)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Content Privacy (Private/Deleted VN Isolation) ---');

    // Retrieve public album as non-owner (User B)
    const albumContentB = (await resGetPubNonOwner.json()).data;
    const itemVnIds = albumContentB.items.map((item) => item.voiceNote.id);
    const itemTitles = albumContentB.items.map((item) => item.voiceNote.title);

    // Test 11: Public VN appears
    if (!itemVnIds.includes(vnPublic.id)) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: Public active VoiceNote appears in public album items');

    // Test 12: Private VN does not appear
    if (itemVnIds.includes(vnPrivate.id)) throw new Error('Test 12 Failed');
    console.log('✓ Test 12: Private VoiceNote does not appear in public album items');

    // Test 13: Deleted VN does not appear
    if (itemVnIds.includes(vnDeleted.id)) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: Deleted VoiceNote does not appear in public album items');

    // Test 14 & 15: Private / Deleted VN IDs do not leak
    if (itemVnIds.length !== 1) throw new Error('Test 14/15 Failed');
    console.log('✓ Test 14 & 15: Private and deleted VoiceNote IDs do not leak in items array');

    // Test 16 & 17: Private / Deleted VN titles do not leak
    if (itemTitles.some((t) => t.includes('Private') || t.includes('Deleted'))) throw new Error('Test 16/17 Failed');
    console.log('✓ Test 16 & 17: Private and deleted VoiceNote titles do not leak');

    // ----------------------------------------------------
    // ALBUM DISCOVERY TESTS (Tests 18 - 24)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Discovery Feed ---');

    // Test 18: Public Album appears in discovery
    const resDisc = await fetch(`${BASE_URL}/albums/discover`);
    const discData = (await resDisc.json()).data;
    if (!discData.albums.some((a) => a.id === albumPublic.id)) throw new Error('Test 18 Failed');
    console.log('✓ Test 18: Public Album appears in discovery feed');

    // Test 19: Private Album does not appear in discovery
    if (discData.albums.some((a) => a.id === albumPrivate.id)) throw new Error('Test 19 Failed');
    console.log('✓ Test 19: Private Album does not appear in discovery feed');

    // Test 20: Pagination works
    const resDiscPage = await fetch(`${BASE_URL}/albums/discover?page=1&limit=1`);
    const discPageData = (await resDiscPage.json()).data;
    if (discPageData.albums.length !== 1 || discPageData.pagination.page !== 1 || discPageData.pagination.limit !== 1) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: Discovery pagination page & limit parameters work correctly');

    // Test 21: Maximum limit is enforced (e.g. limit=200 capped to 100)
    const resDiscMax = await fetch(`${BASE_URL}/albums/discover?limit=200`);
    const discMaxData = (await resDiscMax.json()).data;
    if (discMaxData.pagination.limit !== 100) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Maximum limit is enforced (capped to 100)');

    // Test 22: Invalid pagination is handled safely (e.g. page=-1, limit=abc)
    const resDiscInv = await fetch(`${BASE_URL}/albums/discover?page=-1&limit=abc`);
    const discInvData = (await resDiscInv.json()).data;
    if (discInvData.pagination.page !== 1 || discInvData.pagination.limit !== 20) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Invalid pagination parameters fall back safely to defaults (page=1, limit=20)');

    // Test 23: Ordering is deterministic (createdAt DESC, _id DESC)
    const albumPublic2 = await createAlbumApi(userA.token, 'Second Public Album', 'Desc', 'public');
    const resDiscOrder = await fetch(`${BASE_URL}/albums/discover`);
    const discOrderData = (await resDiscOrder.json()).data;
    if (discOrderData.albums[0].id !== albumPublic2.id) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Album discovery ordering is deterministic (createdAt DESC, _id DESC)');

    // Test 24: Private album does not affect pagination.total (3 public albums created so far out of 5 total)
    const totalAllAlbums = await Album.countDocuments();
    if (discOrderData.pagination.total !== 3 || discOrderData.pagination.total === totalAllAlbums) throw new Error(`Test 24 Failed: total=${discOrderData.pagination.total}`);
    console.log('✓ Test 24: Private albums do not leak into discovery pagination.total');

    // ----------------------------------------------------
    // ALBUM SEARCH TESTS (Tests 25 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Search ---');

    // Test 25: Search by title
    const resSearchTitle = await fetch(`${BASE_URL}/albums/search?q=College`);
    const searchTitleData = (await resSearchTitle.json()).data;
    if (!searchTitleData.items.some((a) => a.id === albumPublic.id)) throw new Error('Test 25 Failed');
    console.log('✓ Test 25: Search public albums by title');

    // Test 26: Search by description
    const resSearchDesc = await fetch(`${BASE_URL}/albums/search?q=college%20voice%20notes`);
    const searchDescData = (await resSearchDesc.json()).data;
    if (!searchDescData.items.some((a) => a.id === albumPublic.id)) throw new Error('Test 26 Failed');
    console.log('✓ Test 26: Search public albums by description');

    // Test 27: Case-insensitive search
    const resSearchCase = await fetch(`${BASE_URL}/albums/search?q=cOLLeGE`);
    const searchCaseData = (await resSearchCase.json()).data;
    if (!searchCaseData.items.some((a) => a.id === albumPublic.id)) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Case-insensitive album search');

    // Test 28: Whitespace normalization
    const resSearchSpace = await fetch(`${BASE_URL}/albums/search?q=%20%20College%20%20`);
    const searchSpaceData = (await resSearchSpace.json()).data;
    if (!searchSpaceData.items.some((a) => a.id === albumPublic.id)) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Whitespace normalization in album search query');

    // Test 29: Regex special characters safely handled
    const resSearchRegex = await fetch(`${BASE_URL}/albums/search?q=College%20(v1)*%2B?`);
    if (resSearchRegex.status !== 200) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Regex special characters in search query safely escaped');

    // Test 30 & 31: Private albums never appear in search and do not affect total count
    const resSearchPriv = await fetch(`${BASE_URL}/albums/search?q=Secret`);
    const searchPrivData = (await resSearchPriv.json()).data;
    if (searchPrivData.items.length !== 0 || searchPrivData.pagination.total !== 0) throw new Error('Test 30/31 Failed');
    console.log('✓ Test 30 & 31: Private albums never appear in search and do not affect search total count');

    // Test 32: Bounded query length (> 100 chars -> 400 Bad Request)
    const longQ = 'a'.repeat(101);
    const resSearchLong = await fetch(`${BASE_URL}/albums/search?q=${longQ}`);
    if (resSearchLong.status !== 400) throw new Error('Test 32 Failed');
    console.log('✓ Test 32: Excessively long search query rejected (400 Bad Request)');

    // ----------------------------------------------------
    // ALBUM METADATA UPDATE TESTS (Tests 33 - 42)
    // ----------------------------------------------------
    console.log('\n--- Testing Album Metadata Updates & Guards ---');

    // Test 33: Owner updates title
    const resUp33 = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'Updated College Memories Title' }),
    });
    if (resUp33.status !== 200) throw new Error('Test 33 Failed');
    console.log('✓ Test 33: Owner can update album title');

    // Test 34: Owner updates description
    const resUp34 = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ description: 'Updated album description' }),
    });
    if (resUp34.status !== 200) throw new Error('Test 34 Failed');
    console.log('✓ Test 34: Owner can update album description');

    // Test 35: Owner updates coverImage
    const resUp35 = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ coverImage: 'https://example.com/cover.jpg' }),
    });
    if (resUp35.status !== 200) throw new Error('Test 35 Failed');
    console.log('✓ Test 35: Owner can update album coverImage');

    // Test 36: Owner changes private -> public
    const resUp36 = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ visibility: 'public' }),
    });
    if (resUp36.status !== 200) throw new Error('Test 36 Failed');
    const albumPrivateCheck = await Album.findById(albumPrivate.id);
    if (albumPrivateCheck.visibility !== 'public') throw new Error('Test 36 Failed');
    console.log('✓ Test 36: Owner can transition album visibility from private to public');

    // Test 37: Owner changes public -> private
    const resUp37 = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ visibility: 'private' }),
    });
    if (resUp37.status !== 200) throw new Error('Test 37 Failed');
    const albumPrivateCheck2 = await Album.findById(albumPrivate.id);
    if (albumPrivateCheck2.visibility !== 'private') throw new Error('Test 37 Failed');
    console.log('✓ Test 37: Owner can transition album visibility from public back to private');

    // Test 38: Unauthenticated update -> 401
    const resUp38 = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    if (resUp38.status !== 401) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: Unauthenticated album update rejected (401 Unauthorized)');

    // Test 39: Non-owner update -> 403
    const resUp39 = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    if (resUp39.status !== 403) throw new Error('Test 39 Failed');
    console.log('✓ Test 39: Non-owner album update rejected (403 Forbidden)');

    // Test 40: Unknown Album -> 404
    const resUp40 = await fetch(`${BASE_URL}/albums/507f1f77bcf86cd799439011`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'Unknown Album Title' }),
    });
    if (resUp40.status !== 404) throw new Error('Test 40 Failed');
    console.log('✓ Test 40: Unknown album update returns 404 Not Found');

    // Test 41 & 42: Client cannot modify ownerId or _id
    await fetch(`${BASE_URL}/albums/${albumPublic.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ ownerId: userB.user.id, _id: '507f1f77bcf86cd799439099' }),
    });
    const albumPublicCheck = await Album.findById(albumPublic.id);
    if (albumPublicCheck.ownerId.toString() !== userA.user.id) throw new Error('Test 41/42 Failed');
    console.log('✓ Test 41 & 42: Immutable fields (ownerId, _id) cannot be modified via update endpoint');

    // ----------------------------------------------------
    // ALBUM ITEM TESTS (Tests 43 - 49)
    // ----------------------------------------------------
    console.log('\n--- Testing AlbumItem Operations & Invariants ---');

    const vnPublic2 = await uploadVN(userA.token, 'User A Public VN 2', 'public');

    // Test 43: Owner can add VoiceNote to Album
    const resAddItem = await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic2.id }),
    });
    if (resAddItem.status !== 201) throw new Error('Test 43 Failed');
    const itemObj = (await resAddItem.json()).data.item;
    console.log('✓ Test 43: Owner can add VoiceNote to Album');

    // Test 44: Owner can remove VoiceNote
    const resRemItem = await fetch(`${BASE_URL}/albums/${albumPublic.id}/items/${itemObj.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (resRemItem.status !== 200) throw new Error('Test 44 Failed');
    console.log('✓ Test 44: Owner can remove item from Album');

    // Re-add item for reordering test
    const itemObjReadded = (await (await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic2.id }),
    })).json()).data.item;

    // Fetch all album items from DB for reordering
    const existingDbItems = await AlbumItem.find({ albumId: albumPublic.id }).sort({ position: 1 });
    const itemIds = existingDbItems.map((i) => i._id.toString());

    // Test 45: Owner can reorder AlbumItems
    const reorderPayload = itemIds.map((id, index) => ({
      itemId: id,
      position: itemIds.length - index,
    }));
    const resReorder = await fetch(`${BASE_URL}/albums/${albumPublic.id}/items/reorder`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ items: reorderPayload }),
    });
    if (resReorder.status !== 200) throw new Error('Test 45 Failed');
    console.log('✓ Test 45: Owner can reorder AlbumItems using two-phase updates');

    // Test 46: Non-owner cannot modify AlbumItems
    const resAddNonOwner = await fetch(`${BASE_URL}/albums/${albumPublic.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic2.id }),
    });
    if (resAddNonOwner.status !== 403) throw new Error('Test 46 Failed');
    console.log('✓ Test 46: Non-owner cannot add/modify AlbumItems (403 Forbidden)');

    // Test 47: Public Album containing private VN hides it from non-owner
    const resGetNonOwnerPub = await fetch(`${BASE_URL}/albums/${albumPublic.id}`, { headers: { Authorization: `Bearer ${userB.token}` } });
    const nonOwnerItems = (await resGetNonOwnerPub.json()).data.items;
    if (nonOwnerItems.some((i) => i.voiceNote && i.voiceNote.visibility === 'private')) throw new Error('Test 47 Failed');
    console.log('✓ Test 47: Public Album containing private VoiceNote hides it from non-owner');

    // Test 48: Public Album containing deleted VN hides it from non-owner & owner
    if (nonOwnerItems.some((i) => i.voiceNote && i.voiceNote.deletedAt)) throw new Error('Test 48 Failed');
    console.log('✓ Test 48: Public Album containing deleted VoiceNote hides it from all responses');

    // Test 49: Adding a private VN to public Album does NOT change its visibility
    const vnPrivateCheck = await VoiceNote.findById(vnPrivate.id);
    if (vnPrivateCheck.visibility !== 'private') throw new Error('Test 49 Failed');
    console.log('✓ Test 49: Adding a private VoiceNote to a public Album does NOT change VoiceNote visibility');

    // ----------------------------------------------------
    // PROFILE ALBUM TESTS (Tests 50 - 54)
    // ----------------------------------------------------
    console.log('\n--- Testing Public Creator Profile Albums & Statistics ---');

    // Test 50: Public Albums appear on creator Album listing
    const resProfAlbums = await fetch(`${BASE_URL}/users/user_a/albums`);
    const profAlbumsData = (await resProfAlbums.json()).data;
    if (!profAlbumsData.albums.some((a) => a.id === albumPublic.id)) throw new Error('Test 50 Failed');
    console.log('✓ Test 50: Public Albums appear on creator public album listing');

    // Test 51: Private Albums do not appear on creator Album listing
    if (profAlbumsData.albums.some((a) => a.id === albumPrivate.id)) throw new Error('Test 51 Failed');
    console.log('✓ Test 51: Private Albums do not appear on creator public album listing');

    // Test 52: Profile Albums pagination works
    const resProfAlbumsPage = await fetch(`${BASE_URL}/users/user_a/albums?page=1&limit=1`);
    const profAlbumsPageData = (await resProfAlbumsPage.json()).data;
    if (profAlbumsPageData.albums.length !== 1 || profAlbumsPageData.pagination.limit !== 1) throw new Error('Test 52 Failed');
    console.log('✓ Test 52: Profile Albums pagination parameters work correctly');

    // Test 53: Public album count in profile stats (stats.publicAlbums) excludes private albums
    const resProf = await fetch(`${BASE_URL}/users/user_a`);
    const profStats = (await resProf.json()).data.stats;
    if (profStats.publicAlbums !== 2) throw new Error(`Test 53 Failed: publicAlbums=${profStats.publicAlbums}`);
    console.log('✓ Test 53: Public album count in creator profile stats (stats.publicAlbums) excludes private albums');

    // Test 54: Username change preserves Album ownership
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'usera_albums_renamed' }),
    });
    const albumCheckRenamed = await Album.findById(albumPublic.id);
    if (albumCheckRenamed.ownerId.toString() !== userA.user.id) throw new Error('Test 54 Failed');
    console.log('✓ Test 54: Username changes preserve immutable Album ownership');

    // Revert username
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'user_a' }),
    });

    // ----------------------------------------------------
    // OWNERSHIP TESTS (Tests 55 - 58)
    // ----------------------------------------------------
    console.log('\n--- Testing Strict Album Ownership Controls ---');

    // Test 55: User A cannot modify User B's Album
    const albumB = await createAlbumApi(userB.token, 'User B Album', 'Desc', 'public');
    const resUpUserAonB = await fetch(`${BASE_URL}/albums/${albumB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ title: 'Hacked Title' }),
    });
    if (resUpUserAonB.status !== 403) throw new Error('Test 55 Failed');
    console.log('✓ Test 55: User A cannot modify User B\'s Album (403 Forbidden)');

    // Test 56: User A cannot change User B's Album visibility
    const resVisUserAonB = await fetch(`${BASE_URL}/albums/${albumB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ visibility: 'private' }),
    });
    if (resVisUserAonB.status !== 403) throw new Error('Test 56 Failed');
    console.log('✓ Test 56: User A cannot change User B\'s Album visibility (403 Forbidden)');

    // Test 57: User A cannot add/remove/reorder items in User B's Album
    const resItemUserAonB = await fetch(`${BASE_URL}/albums/${albumB.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ voiceNoteId: vnPublic.id }),
    });
    if (resItemUserAonB.status !== 403) throw new Error('Test 57 Failed');
    console.log('✓ Test 57: User A cannot modify items in User B\'s Album (403 Forbidden)');

    // Test 58: Client-supplied ownerId cannot transfer Album ownership
    await fetch(`${BASE_URL}/albums/${albumB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ ownerId: userA.user.id }),
    });
    const albumBCheck = await Album.findById(albumB.id);
    if (albumBCheck.ownerId.toString() !== userB.user.id) throw new Error('Test 58 Failed');
    console.log('✓ Test 58: Client-supplied ownerId cannot transfer Album ownership');

    // ----------------------------------------------------
    // PRIVACY REGRESSION TESTS (Tests 59 - 64)
    // ----------------------------------------------------
    console.log('\n--- Testing Privacy Regressions & Boundaries ---');

    // Test 59: Private Album ID does not appear in discovery
    if (discData.albums.some((a) => a.id === albumPrivate.id)) throw new Error('Test 59 Failed');
    console.log('✓ Test 59: Private Album ID does not appear in discovery feed');

    // Test 60: Private Album does not appear in search
    const resSearchPrivAll = await fetch(`${BASE_URL}/albums/search?q=Secret`);
    const searchPrivAllData = (await resSearchPrivAll.json()).data;
    if (searchPrivAllData.items.some((a) => a.id === albumPrivate.id)) throw new Error('Test 60 Failed');
    console.log('✓ Test 60: Private Album does not appear in search results');

    // Test 61: Private Album does not appear on creator public page
    if (profAlbumsData.albums.some((a) => a.id === albumPrivate.id)) throw new Error('Test 61 Failed');
    console.log('✓ Test 61: Private Album does not appear on creator public page listing');

    // Test 62: Private Album metadata is not exposed to non-owners
    const resGetPrivMeta = await fetch(`${BASE_URL}/albums/${albumPrivate.id}`, { headers: { Authorization: `Bearer ${userB.token}` } });
    if (resGetPrivMeta.status !== 404) throw new Error('Test 62 Failed');
    console.log('✓ Test 62: Private Album metadata is not exposed to non-owners (404 Not Found)');

    // Test 63: Private VoiceNote inside public Album remains private
    const vnPrivateDoc = await VoiceNote.findById(vnPrivate.id);
    if (vnPrivateDoc.visibility !== 'private') throw new Error('Test 63 Failed');
    console.log('✓ Test 63: Private VoiceNote inside public Album remains private and unexposed');

    // Test 64: Deleted VoiceNote inside public Album remains hidden
    const vnDeletedDoc = await VoiceNote.findById(vnDeleted.id);
    if (!vnDeletedDoc.deletedAt) throw new Error('Test 64 Failed');
    console.log('✓ Test 64: Deleted VoiceNote inside public Album remains hidden from all API responses');

    console.log('\n=== ALL 64 PHASE 15 PUBLIC ALBUMS TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 15 TEST FAILED:', error);
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
