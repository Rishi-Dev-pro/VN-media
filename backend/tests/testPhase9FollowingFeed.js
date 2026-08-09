const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const Follow = require('../src/models/Follow');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5009;
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
  console.log('=== PHASE 9 FOLLOWING FEED TEST SUITE ===\n');

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
    console.log('[Test DB] Cleared test DB and created indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login 5 Test Users: User A, User B, User C, User D, User E
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
    const userD = await registerUser('user_d', 'userd@example.com');
    const userE = await registerUser('user_e', 'usere@example.com');

    // Setup Follow relationships: User A follows B and C (A does NOT follow D or E initially)
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    // Setup Content:
    // User B: Public VN B1 (10:00), Public VN B2 (10:05), Private VN B3
    // User C: Public VN C1 (10:02), Private VN C2
    // User D: Public VN D1 (10:03)
    // User E: Private VN E1
    const uploadVN = async (token, title, visibility) => {
      const res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: createUploadFormData({ title, visibility, buffer: createMinimalWavBuffer(1) }),
      });
      return (await res.json()).data.voiceNote;
    };

    const vnB1 = await uploadVN(userB.token, 'B Public Audio 1', 'public');
    await new Promise((r) => setTimeout(r, 20));
    const vnC1 = await uploadVN(userC.token, 'C Public Audio 1', 'public');
    await new Promise((r) => setTimeout(r, 20));
    const vnD1 = await uploadVN(userD.token, 'D Public Audio 1', 'public');
    await new Promise((r) => setTimeout(r, 20));
    const vnB2 = await uploadVN(userB.token, 'B Public Audio 2', 'public');
    const vnB3 = await uploadVN(userB.token, 'B Private Audio 3', 'private');
    const vnC2 = await uploadVN(userC.token, 'C Private Audio 2', 'private');
    const vnE1 = await uploadVN(userE.token, 'E Private Audio 1', 'private');

    console.log('Setup completed: Created 5 Users (A, B, C, D, E). A follows B and C.\n');

    // ----------------------------------------------------
    // FOLLOWING FEED TESTS (Tests 1 - 10)
    // ----------------------------------------------------
    console.log('--- Testing Following Feed Access & Filtering (GET /api/vns/feed/following) ---');

    // Test 1: Authenticated User A can access following feed
    const resFeed1 = await fetch(`${BASE_URL}/vns/feed/following`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const dataFeed1 = await resFeed1.json();
    if (resFeed1.status !== 200 || !dataFeed1.data.items) throw new Error(`Test 1 Failed: ${JSON.stringify(dataFeed1)}`);
    console.log('✓ Test 1: Authenticated User A can access following feed (200 OK)');

    // Test 2: Unauthenticated request returns 401
    const resFeed2 = await fetch(`${BASE_URL}/vns/feed/following`);
    if (resFeed2.status !== 401) throw new Error('Test 2 Failed');
    console.log('✓ Test 2: Unauthenticated request returns 401 Unauthorized');

    // Test 3: Invalid JWT returns 401
    const resFeed3 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: 'Bearer invalid_token' } });
    if (resFeed3.status !== 401) throw new Error('Test 3 Failed');
    console.log('✓ Test 3: Invalid JWT returns 401 Unauthorized');

    // Test 4: Expired JWT returns 401 (Simulated via bad token format)
    const resFeed4 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.s5_s' } });
    if (resFeed4.status !== 401) throw new Error('Test 4 Failed');
    console.log('✓ Test 4: Expired/malformed JWT returns 401 Unauthorized');

    // Test 5: User A sees User B's public VoiceNote
    const feedVnIds = dataFeed1.data.items.map((item) => item.id);
    if (!feedVnIds.includes(vnB1.id) || !feedVnIds.includes(vnB2.id)) throw new Error('Test 5 Failed: B\'s public VNs missing');
    console.log('✓ Test 5: User A sees User B\'s public VoiceNotes');

    // Test 6: User A sees User C's public VoiceNote
    if (!feedVnIds.includes(vnC1.id)) throw new Error('Test 6 Failed: C\'s public VN missing');
    console.log('✓ Test 6: User A sees User C\'s public VoiceNote');

    // Test 7: User A does NOT see User D's public VoiceNote (User A does not follow D)
    if (feedVnIds.includes(vnD1.id)) throw new Error('Test 7 Failed: D\'s public VN leaked in feed');
    console.log('✓ Test 7: User A does NOT see unfollowed User D\'s public VoiceNote');

    // Test 8: User A does NOT see User E's private VoiceNote
    if (feedVnIds.includes(vnE1.id)) throw new Error('Test 8 Failed: E\'s private VN leaked in feed');
    console.log('✓ Test 8: User A does NOT see User E\'s private VoiceNote');

    // Test 9: User B's private VoiceNote is excluded from feed
    if (feedVnIds.includes(vnB3.id)) throw new Error('Test 9 Failed: B\'s private VN leaked in feed');
    console.log('✓ Test 9: User B\'s private VoiceNote is excluded from feed');

    // Test 10: User C's private VoiceNote is excluded from feed
    if (feedVnIds.includes(vnC2.id)) throw new Error('Test 10 Failed: C\'s private VN leaked in feed');
    console.log('✓ Test 10: User C\'s private VoiceNote is excluded from feed');

    // ----------------------------------------------------
    // FEED PRIVACY TESTS (Tests 11 - 17)
    // ----------------------------------------------------
    console.log('\n--- Testing Feed Privacy Boundaries ---');

    // Test 11: Private VoiceNote does not appear in items array
    if (dataFeed1.data.items.some((item) => item.visibility === 'private')) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: Private VoiceNote does not appear in feed items array');

    // Test 12: Private VoiceNote does not affect pagination total (total = 3: B1, B2, C1)
    if (dataFeed1.data.pagination.total !== 3) throw new Error(`Test 12 Failed: Total count leaked private VNs: ${dataFeed1.data.pagination.total}`);
    console.log('✓ Test 12: Private VoiceNote does not affect pagination total (total = 3)');

    // Test 13: Private VoiceNote title is not leaked anywhere in response
    const rawFeedStr = JSON.stringify(dataFeed1);
    if (rawFeedStr.includes('B Private Audio 3') || rawFeedStr.includes('C Private Audio 2')) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: Private VoiceNote title is not leaked anywhere in response');

    // Test 14: Private VoiceNote ID is not leaked anywhere in response
    if (rawFeedStr.includes(vnB3.id) || rawFeedStr.includes(vnC2.id)) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Private VoiceNote ID is not leaked anywhere in response');

    // Test 15: Following relationship does not bypass VoiceNote authorization
    const resGetPriv = await fetch(`${BASE_URL}/vns/${vnB3.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resGetPriv.status !== 403) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Following relationship does not bypass VoiceNote GET authorization (403 Forbidden)');

    // Test 16: User A cannot stream User B's private VN merely because A follows B (403)
    const resStream = await fetch(`${BASE_URL}/vns/${vnB3.id}/stream`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resStream.status !== 403) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: User A cannot stream User B\'s private VN (403 Forbidden)');

    // Test 17: User A cannot download User B's private VN merely because A follows B (403)
    const resDownload = await fetch(`${BASE_URL}/vns/${vnB3.id}/download`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resDownload.status !== 403) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: User A cannot download User B\'s private VN (403 Forbidden)');

    // ----------------------------------------------------
    // FEED ORDERING TESTS (Tests 18 - 20)
    // ----------------------------------------------------
    console.log('\n--- Testing Deterministic Feed Ordering ---');

    // Test 18: Feed is sorted newest-first (createdAt DESC)
    const items18 = dataFeed1.data.items;
    if (new Date(items18[0].createdAt) < new Date(items18[1].createdAt) || new Date(items18[1].createdAt) < new Date(items18[2].createdAt)) {
      throw new Error('Test 18 Failed: Feed items not sorted by createdAt DESC');
    }
    console.log('✓ Test 18: Feed is sorted newest-first (createdAt DESC)');

    // Test 19: Feed ordering is deterministic
    const resFeed19 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items19 = (await resFeed19.json()).data.items;
    if (items19[0].id !== items18[0].id || items19[1].id !== items18[1].id || items19[2].id !== items18[2].id) {
      throw new Error('Test 19 Failed: Ordering non-deterministic');
    }
    console.log('✓ Test 19: Feed ordering is deterministic across repeated calls');

    // Test 20: VoiceNotes from different creators are globally interleaved by creation time
    // Order should be: B2 (newest), C1 (middle), B1 (oldest)
    if (items18[0].id !== vnB2.id || items18[1].id !== vnC1.id || items18[2].id !== vnB1.id) {
      throw new Error(`Test 20 Failed: Items not globally interleaved by creation time. Order: ${items18.map((i) => i.title)}`);
    }
    console.log('✓ Test 20: VoiceNotes from different creators (B2, C1, B1) are globally interleaved');

    // ----------------------------------------------------
    // PAGINATION TESTS (Tests 21 - 30)
    // ----------------------------------------------------
    console.log('\n--- Testing Following Feed Pagination ---');

    // Test 21: Default page (1) works
    if (dataFeed1.data.pagination.page !== 1) throw new Error('Test 21 Failed');
    console.log('✓ Test 21: Default page (1) works');

    // Test 22: Default limit (20) works
    if (dataFeed1.data.pagination.limit !== 20) throw new Error('Test 22 Failed');
    console.log('✓ Test 22: Default limit (20) works');

    // Test 23: Custom page works (?page=2)
    const resPag23 = await fetch(`${BASE_URL}/vns/feed/following?page=2&limit=2`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataPag23 = await resPag23.json();
    if (resPag23.status !== 200 || dataPag23.data.pagination.page !== 2) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Custom page works (?page=2)');

    // Test 24: Custom limit works (?limit=1)
    const resPag24 = await fetch(`${BASE_URL}/vns/feed/following?page=1&limit=1`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataPag24 = await resPag24.json();
    if (dataPag24.data.items.length !== 1 || dataPag24.data.pagination.limit !== 1) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Custom limit works (?limit=1)');

    // Test 25: Results correctly span multiple pages
    const resPag25Page2 = await fetch(`${BASE_URL}/vns/feed/following?page=2&limit=1`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const dataPag25Page2 = await resPag25Page2.json();
    if (dataPag25Page2.data.items[0].id === dataPag24.data.items[0].id) throw new Error('Test 25 Failed: Page 2 returned same item as Page 1');
    console.log('✓ Test 25: Results correctly span multiple pages without overlap');

    // Test 26: No duplicate VoiceNotes appear across page traversal
    const page1Id = dataPag24.data.items[0].id;
    const page2Id = dataPag25Page2.data.items[0].id;
    if (page1Id === page2Id) throw new Error('Test 26 Failed: Duplicate item across pages');
    console.log('✓ Test 26: No duplicate VoiceNotes appear across page traversal');

    // Test 27: Excessive limit is capped at 100
    const resPag27 = await fetch(`${BASE_URL}/vns/feed/following?limit=999999`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resPag27.json()).data.pagination.limit > 100) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Excessive limit is constrained (capped at 100)');

    // Test 28: Invalid page is handled safely
    const resPag28 = await fetch(`${BASE_URL}/vns/feed/following?page=-5`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resPag28.json()).data.pagination.page !== 1) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Invalid page is handled safely (defaults to page 1)');

    // Test 29: Invalid limit is handled safely
    const resPag29 = await fetch(`${BASE_URL}/vns/feed/following?limit=abc`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if ((await resPag29.json()).data.pagination.limit !== 20) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Invalid limit is handled safely (defaults to limit 20)');

    // Test 30: Pagination total counts ONLY eligible public VoiceNotes (total = 3)
    if (dataFeed1.data.pagination.total !== 3) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: Pagination total counts ONLY eligible public VoiceNotes (total = 3)');

    // ----------------------------------------------------
    // EMPTY FEED TESTS (Tests 31 - 33)
    // ----------------------------------------------------
    console.log('\n--- Testing Empty Feed Conditions ---');

    // Test 31: User with no follows receives empty feed
    const resEmpty31 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userD.token}` } });
    const dataEmpty31 = await resEmpty31.json();
    if (resEmpty31.status !== 200 || dataEmpty31.data.items.length !== 0 || dataEmpty31.data.pagination.total !== 0) {
      throw new Error(`Test 31 Failed: ${JSON.stringify(dataEmpty31)}`);
    }
    console.log('✓ Test 31: User following nobody receives empty feed (items: [], total: 0)');

    // Test 32: User following creators with no VoiceNotes receives empty feed
    // User D follows User A (User A has uploaded 0 VNs)
    await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userD.token}` } });
    const resEmpty32 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userD.token}` } });
    if ((await resEmpty32.json()).data.items.length !== 0) throw new Error('Test 32 Failed');
    console.log('✓ Test 32: User following creator with no VNs receives empty feed');

    // Test 33: User following creators with only private VoiceNotes receives empty feed
    // User D follows User E (User E has uploaded ONLY private VN E1)
    await fetch(`${BASE_URL}/users/${userE.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userD.token}` } });
    const resEmpty33 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userD.token}` } });
    const dataEmpty33 = await resEmpty33.json();
    if (dataEmpty33.data.items.length !== 0 || dataEmpty33.data.pagination.total !== 0) throw new Error('Test 33 Failed');
    console.log('✓ Test 33: User following creator with only private VNs receives empty feed (total: 0)');

    // Clean up User D follows
    await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userD.token}` } });
    await fetch(`${BASE_URL}/users/${userE.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userD.token}` } });

    // ----------------------------------------------------
    // FOLLOW / UNFOLLOW DYNAMIC TESTS (Tests 34 - 37)
    // ----------------------------------------------------
    console.log('\n--- Testing Dynamic Follow / Unfollow Feed Updates ---');

    // Test 34: User A follows User D -> User D's public VoiceNote appears in User A's feed
    await fetch(`${BASE_URL}/users/${userD.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const resDyn34 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items34 = (await resDyn34.json()).data.items;
    if (!items34.some((i) => i.id === vnD1.id)) throw new Error('Test 34 Failed: D\'s public VN did not appear after follow');
    console.log('✓ Test 34: User A follows User D -> User D\'s public VN appears in feed');

    // Test 35: User A unfollows User D -> User D's public VoiceNote disappears from feed
    await fetch(`${BASE_URL}/users/${userD.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userA.token}` } });
    const resDyn35 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items35 = (await resDyn35.json()).data.items;
    if (items35.some((i) => i.id === vnD1.id)) throw new Error('Test 35 Failed: D\'s public VN did not disappear after unfollow');
    console.log('✓ Test 35: User A unfollows User D -> User D\'s public VN disappears from feed');

    // Test 36: User A follows User E -> User E uploads newly-public VN -> appears in User A's feed
    await fetch(`${BASE_URL}/users/${userE.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const vnE2 = await uploadVN(userE.token, 'E Newly Public Audio', 'public');
    const resDyn36 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items36 = (await resDyn36.json()).data.items;
    if (!items36.some((i) => i.id === vnE2.id)) throw new Error('Test 36 Failed: E\'s new public VN missing');
    console.log('✓ Test 36: User A follows User E -> User E\'s newly-created public VN appears in feed');

    // Test 37: User A follows User E -> User E's private VN E1 remains absent
    if (items36.some((i) => i.id === vnE1.id)) throw new Error('Test 37 Failed: E\'s private VN leaked');
    console.log('✓ Test 37: User A follows User E -> User E\'s private VN remains absent');

    // ----------------------------------------------------
    // VISIBILITY TRANSITION TESTS (Tests 38 - 42)
    // ----------------------------------------------------
    console.log('\n--- Testing Public <-> Private Visibility Transitions ---');

    // Test 38: Followed creator's public VoiceNote appears (vnB1 is in feed)
    if (!items36.some((i) => i.id === vnB1.id)) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: Followed creator\'s public VoiceNote (B1) appears in feed');

    // Test 39 & 40: Followed creator changes VN B1 from public -> private -> VN B1 disappears from feed
    await fetch(`${BASE_URL}/vns/${vnB1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ visibility: 'private' }),
    });
    const resVis40 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items40 = (await resVis40.json()).data.items;
    if (items40.some((i) => i.id === vnB1.id)) throw new Error('Test 40 Failed: VN B1 did not disappear after public->private transition');
    console.log('✓ Test 39 & 40: Changing VN B1 public -> private removes it from following feed');

    // Test 41 & 42: Changing VN B1 private -> public makes it eligible and reappear in feed
    await fetch(`${BASE_URL}/vns/${vnB1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ visibility: 'public' }),
    });
    const resVis42 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items42 = (await resVis42.json()).data.items;
    if (!items42.some((i) => i.id === vnB1.id)) throw new Error('Test 42 Failed: VN B1 did not reappear after private->public transition');
    console.log('✓ Test 41 & 42: Changing VN B1 private -> public makes it reappear in following feed');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 43 - 46)
    // ----------------------------------------------------
    console.log('\n--- Testing Followed Creator Username Changes ---');

    // Test 43 & 44: User B changes username to user_b_renamed -> B's public VNs remain in feed
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ username: 'user_b_renamed' }),
    });
    const resName44 = await fetch(`${BASE_URL}/vns/feed/following`, { headers: { Authorization: `Bearer ${userA.token}` } });
    const items44 = (await resName44.json()).data.items;
    const bItems44 = items44.filter((i) => i.id === vnB1.id || i.id === vnB2.id);
    if (bItems44.length !== 2) throw new Error('Test 44 Failed: B\'s VNs missing after username change');
    console.log('✓ Test 43 & 44: Followed creator changes username -> VNs remain in following feed');

    // Test 45: Feed ownership remains tied to User _id
    const vnDoc45 = await VoiceNote.findById(vnB1.id);
    if (vnDoc45.ownerId.toString() !== userB.user.id) throw new Error('Test 45 Failed');
    console.log('✓ Test 45: Feed ownership remains tied to User _id');

    // Test 46: Creator information in feed shows new username ('user_b_renamed')
    if (bItems44[0].owner.username !== 'user_b_renamed') throw new Error(`Test 46 Failed: Creator username not updated: ${bItems44[0].owner.username}`);
    console.log('✓ Test 46: Creator information in feed shows new username (user_b_renamed)');

    // Revert User B username
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` }, body: JSON.stringify({ username: 'user_b' }) });

    // ----------------------------------------------------
    // PROFILE / FEED CONSISTENCY TESTS (Tests 47 - 49)
    // ----------------------------------------------------
    console.log('\n--- Testing Profile / Feed Consistency ---');

    // Test 47: Public VN B2 appears in both creator profile VNs and following feed
    const resProf47 = await fetch(`${BASE_URL}/users/user_b/voice-notes`);
    const profVnIds47 = (await resProf47.json()).data.voiceNotes.map((v) => v.id);
    const feedVnIds47 = items44.map((v) => v.id);
    if (!profVnIds47.includes(vnB2.id) || !feedVnIds47.includes(vnB2.id)) throw new Error('Test 47 Failed');
    console.log('✓ Test 47: Public VN B2 appears in both creator profile VNs and following feed');

    // Test 48: Private VN B3 appears in neither
    if (profVnIds47.includes(vnB3.id) || feedVnIds47.includes(vnB3.id)) throw new Error('Test 48 Failed');
    console.log('✓ Test 48: Private VN B3 appears in neither creator profile nor following feed');

    // Test 49: Unfollowed creator D's public VN D1 is in public feed (/api/vns/feed) but NOT following feed
    const resPublicFeed49 = await fetch(`${BASE_URL}/vns/feed`);
    const publicFeedIds49 = (await resPublicFeed49.json()).data.voiceNotes.map((v) => v.id);
    if (!publicFeedIds49.includes(vnD1.id) || feedVnIds47.includes(vnD1.id)) throw new Error('Test 49 Failed');
    console.log('✓ Test 49: Unfollowed creator D\'s public VN is in public discovery feed but NOT following feed');

    console.log('\n=== ALL 49 PHASE 9 FOLLOWING FEED TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 9 FEED TEST FAILED:', error);
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
