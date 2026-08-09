const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5006;
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
  console.log('=== PHASE 6 SEARCH, TAGS & DISCOVERY TEST SUITE ===\n');

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
      body: JSON.stringify({ username: 'user_a', email: 'usera@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;

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
    const tokenB = (await loginBRes.json()).data.token;

    // ----------------------------------------------------
    // TAG TESTS (Tests 1 - 10)
    // ----------------------------------------------------
    console.log('--- Testing Tag Validation & Normalization ---');

    // Test 1: VoiceNote accepts tags during upload
    const resTest1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'College Memories',
        description: 'First year at university',
        visibility: 'public',
        tags: ['College', 'Memories'],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const dataTest1 = await resTest1.json();
    if (resTest1.status !== 201 || !dataTest1.data.voiceNote.tags) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataTest1)}`);
    }
    const vn1 = dataTest1.data.voiceNote;
    console.log('✓ Test 1: VoiceNote accepts tags during upload (201 Created)');

    // Test 2: Tags are normalized to lowercase
    if (!vn1.tags.includes('college') || !vn1.tags.includes('memories')) {
      throw new Error(`Test 2 Failed: Tags not lowercased: ${JSON.stringify(vn1.tags)}`);
    }
    console.log('✓ Test 2: Tags are normalized to lowercase');

    // Test 3: Leading/trailing whitespace is removed
    const resTest3 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Whitespace Test',
        tags: '  friends ,  fun  ',
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const tags3 = (await resTest3.json()).data.voiceNote.tags;
    if (!tags3.includes('friends') || !tags3.includes('fun')) {
      throw new Error(`Test 3 Failed: Whitespace not trimmed: ${JSON.stringify(tags3)}`);
    }
    console.log('✓ Test 3: Leading/trailing whitespace is removed');

    // Test 4: Duplicate tags are removed
    const resTest4 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Deduplication Test',
        tags: ['music', 'MUSIC', ' music '],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const tags4 = (await resTest4.json()).data.voiceNote.tags;
    if (tags4.length !== 1 || tags4[0] !== 'music') {
      throw new Error(`Test 4 Failed: Deduplication failed: ${JSON.stringify(tags4)}`);
    }
    console.log('✓ Test 4: Duplicate tags are removed (deduplicated)');

    // Test 5: Empty tags are rejected/removed
    const resTest5 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Empty Tag Test',
        tags: ['', '   ', 'travel'],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const tags5 = (await resTest5.json()).data.voiceNote.tags;
    if (tags5.length !== 1 || tags5[0] !== 'travel') {
      throw new Error(`Test 5 Failed: Empty tags not removed: ${JSON.stringify(tags5)}`);
    }
    console.log('✓ Test 5: Empty tags are removed');

    // Test 6: Maximum tag count is enforced (max 10)
    const resTest6 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Excess Tags Test',
        tags: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    if (resTest6.status !== 400) throw new Error('Test 6 Failed: Excess tags allowed');
    console.log('✓ Test 6: Maximum tag count (10) is enforced (400 Bad Request)');

    // Test 7: Maximum tag length is enforced (max 30 chars per tag)
    const resTest7 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Long Tag Test',
        tags: ['a'.repeat(31)],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    if (resTest7.status !== 400) throw new Error('Test 7 Failed: Oversized tag allowed');
    console.log('✓ Test 7: Maximum tag length (30 chars) is enforced (400 Bad Request)');

    // Test 8: Tags are stored correctly in MongoDB
    const dbVn = await VoiceNote.findById(vn1.id);
    if (!dbVn || dbVn.tags.length !== 2) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Tags are stored correctly in MongoDB document');

    // Test 9: Owner can update tags via PATCH /api/vns/:id
    const resTest9 = await fetch(`${BASE_URL}/vns/${vn1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ tags: ['campus', 'study'] }),
    });
    const dataTest9 = await resTest9.json();
    if (resTest9.status !== 200 || !dataTest9.data.voiceNote.tags.includes('campus')) {
      throw new Error(`Test 9 Failed: ${JSON.stringify(dataTest9)}`);
    }
    console.log('✓ Test 9: Owner can update tags (PATCH /api/vns/:id)');

    // Test 10: Non-owner CANNOT update tags (403)
    const resTest10 = await fetch(`${BASE_URL}/vns/${vn1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ tags: ['hacked'] }),
    });
    if (resTest10.status !== 403) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Non-owner CANNOT update tags (403 Forbidden)');

    // Reset vn1 tags to ['college', 'memories'] for search tests
    await fetch(`${BASE_URL}/vns/${vn1.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ tags: ['college', 'memories'] }),
    });

    // Create additional public and private test VoiceNotes
    // Public VN 2 (User B): title="Morning Motivation", desc="Daily thoughts", tags=["motivation", "morning"]
    const resPub2 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: createUploadFormData({
        title: 'Morning Motivation',
        description: 'Daily thoughts for success',
        visibility: 'public',
        tags: ['motivation', 'morning'],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const vn2 = (await resPub2.json()).data.voiceNote;

    // Private VN 1 (User A): title="Secret College Recording", desc="Private memory", tags=["secret", "college"]
    const resPriv1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Secret College Recording',
        description: 'Private memory from college',
        visibility: 'private',
        tags: ['secret', 'college'],
        buffer: createMinimalWavBuffer(1),
      }),
    });
    const vnPriv1 = (await resPriv1.json()).data.voiceNote;

    // ----------------------------------------------------
    // SEARCH TESTS (Tests 11 - 20)
    // ----------------------------------------------------
    console.log('\n--- Testing Deterministic Search (GET /api/vns/search) ---');

    // Test 11: Search by title returns matching public VN
    const resSearch11 = await fetch(`${BASE_URL}/vns/search?q=Memories`);
    const dataSearch11 = await resSearch11.json();
    if (resSearch11.status !== 200 || dataSearch11.data.items.length !== 1 || dataSearch11.data.items[0].id !== vn1.id) {
      throw new Error(`Test 11 Failed: ${JSON.stringify(dataSearch11)}`);
    }
    console.log('✓ Test 11: Search by title returns matching public VN');

    // Test 12: Search by description returns matching public VN
    const resSearch12 = await fetch(`${BASE_URL}/vns/search?q=university`);
    const dataSearch12 = await resSearch12.json();
    if (resSearch12.status !== 200 || dataSearch12.data.items.length !== 1 || dataSearch12.data.items[0].id !== vn1.id) {
      throw new Error(`Test 12 Failed: ${JSON.stringify(dataSearch12)}`);
    }
    console.log('✓ Test 12: Search by description returns matching public VN');

    // Test 13: Search by tag returns matching public VN
    const resSearch13 = await fetch(`${BASE_URL}/vns/search?q=motivation`);
    const dataSearch13 = await resSearch13.json();
    if (resSearch13.status !== 200 || dataSearch13.data.items.length !== 1 || dataSearch13.data.items[0].id !== vn2.id) {
      throw new Error(`Test 13 Failed: ${JSON.stringify(dataSearch13)}`);
    }
    console.log('✓ Test 13: Search by tag returns matching public VN');

    // Test 14: Search is case-insensitive
    const resSearch14 = await fetch(`${BASE_URL}/vns/search?q=MoTiVaTiOn`);
    const dataSearch14 = await resSearch14.json();
    if (resSearch14.status !== 200 || dataSearch14.data.items.length !== 1) {
      throw new Error(`Test 14 Failed: ${JSON.stringify(dataSearch14)}`);
    }
    console.log('✓ Test 14: Search is case-insensitive');

    // Test 15: Search with whitespace around query works correctly
    const resSearch15 = await fetch(`${BASE_URL}/vns/search?q=%20%20motivation%20%20`);
    const dataSearch15 = await resSearch15.json();
    if (resSearch15.status !== 200 || dataSearch15.data.items.length !== 1) {
      throw new Error(`Test 15 Failed: ${JSON.stringify(dataSearch15)}`);
    }
    console.log('✓ Test 15: Search with surrounding whitespace works correctly');

    // Test 16: Non-matching query returns zero results (200 OK with empty array)
    const resSearch16 = await fetch(`${BASE_URL}/vns/search?q=nonexistent12345`);
    const dataSearch16 = await resSearch16.json();
    if (resSearch16.status !== 200 || dataSearch16.data.items.length !== 0 || dataSearch16.data.pagination.total !== 0) {
      throw new Error(`Test 16 Failed: ${JSON.stringify(dataSearch16)}`);
    }
    console.log('✓ Test 16: Non-matching query returns zero results (200 OK, empty items array)');

    // Test 17: Search NEVER returns private VoiceNotes
    const resSearch17 = await fetch(`${BASE_URL}/vns/search?q=secret`);
    const dataSearch17 = await resSearch17.json();
    if (dataSearch17.data.items.some((item) => item.id === vnPriv1.id || item.visibility === 'private')) {
      throw new Error('Test 17 Failed: Private VoiceNote returned in search');
    }
    console.log('✓ Test 17: Search NEVER returns private VoiceNotes');

    // Test 18: Search cannot reveal private VN through total counts
    const resSearch18 = await fetch(`${BASE_URL}/vns/search?q=college`);
    const dataSearch18 = await resSearch18.json();
    // Public matches: vn1 ("College Memories"). Private matches: vnPriv1 ("Secret College Recording")
    if (dataSearch18.data.pagination.total !== 1) {
      throw new Error(`Test 18 Failed: Total count leaked private VN: total=${dataSearch18.data.pagination.total}`);
    }
    console.log('✓ Test 18: Search cannot reveal private VN through total counts');

    // Test 19: Search cannot reveal private VN through pagination
    if (dataSearch18.data.items.length !== 1 || dataSearch18.data.items[0].id !== vn1.id) {
      throw new Error('Test 19 Failed: Pagination returned private VN');
    }
    console.log('✓ Test 19: Search cannot reveal private VN through pagination');

    // Test 20: Search result fields contain no sensitive information
    const rawSearchItemStr = JSON.stringify(dataSearch18.data.items[0]);
    if (rawSearchItemStr.includes('passwordHash') || rawSearchItemStr.includes('storage/audio') || rawSearchItemStr.includes('C:')) {
      throw new Error('Test 20 Failed: Sensitive data leaked in search results');
    }
    console.log('✓ Test 20: Search result fields contain no sensitive information');

    // ----------------------------------------------------
    // TAG DISCOVERY TESTS (Tests 21 - 25)
    // ----------------------------------------------------
    console.log('\n--- Testing Tag Discovery (GET /api/vns/tags/:tag) ---');

    // Test 21: GET /api/vns/tags/:tag returns matching public VNs
    const resTag21 = await fetch(`${BASE_URL}/vns/tags/college`);
    const dataTag21 = await resTag21.json();
    if (resTag21.status !== 200 || dataTag21.data.items.length !== 1 || dataTag21.data.items[0].id !== vn1.id) {
      throw new Error(`Test 21 Failed: ${JSON.stringify(dataTag21)}`);
    }
    console.log('✓ Test 21: GET /api/vns/tags/:tag returns matching public VNs');

    // Test 22: Tag lookup is case-insensitive
    const resTag22 = await fetch(`${BASE_URL}/vns/tags/CoLLeGe`);
    const dataTag22 = await resTag22.json();
    if (resTag22.status !== 200 || dataTag22.data.items.length !== 1) {
      throw new Error('Test 22 Failed');
    }
    console.log('✓ Test 22: Tag lookup is case-insensitive');

    // Test 23: Tag lookup ignores surrounding whitespace
    const resTag23 = await fetch(`${BASE_URL}/vns/tags/%20%20college%20%20`);
    const dataTag23 = await resTag23.json();
    if (resTag23.status !== 200 || dataTag23.data.items.length !== 1) {
      throw new Error('Test 23 Failed');
    }
    console.log('✓ Test 23: Tag lookup ignores surrounding whitespace');

    // Test 24: Private VNs are excluded from tag discovery
    const resTag24 = await fetch(`${BASE_URL}/vns/tags/secret`);
    const dataTag24 = await resTag24.json();
    if (dataTag24.data.items.length !== 0 || dataTag24.data.pagination.total !== 0) {
      throw new Error('Test 24 Failed: Private VN found in tag discovery');
    }
    console.log('✓ Test 24: Private VNs are excluded from tag discovery');

    // Test 25: Unknown tag returns empty result
    const resTag25 = await fetch(`${BASE_URL}/vns/tags/unknown123`);
    const dataTag25 = await resTag25.json();
    if (resTag25.status !== 200 || dataTag25.data.items.length !== 0) {
      throw new Error('Test 25 Failed');
    }
    console.log('✓ Test 25: Unknown tag returns an empty result (200 OK)');

    // ----------------------------------------------------
    // PAGINATION TESTS (Tests 26 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Search & Discovery Pagination ---');

    // Test 26: Default page/limit works
    const resPag26 = await fetch(`${BASE_URL}/vns/search`);
    const dataPag26 = await resPag26.json();
    if (resPag26.status !== 200 || dataPag26.data.pagination.limit !== 20 || dataPag26.data.pagination.page !== 1) {
      throw new Error(`Test 26 Failed: ${JSON.stringify(dataPag26)}`);
    }
    console.log('✓ Test 26: Default page (1) and limit (20) work');

    // Test 27: Custom page/limit works
    const resPag27 = await fetch(`${BASE_URL}/vns/search?page=1&limit=1`);
    const dataPag27 = await resPag27.json();
    if (dataPag27.data.items.length !== 1 || dataPag27.data.pagination.limit !== 1) {
      throw new Error('Test 27 Failed');
    }
    console.log('✓ Test 27: Custom page and limit work');

    // Test 28: Results are correctly paginated
    const resPag28 = await fetch(`${BASE_URL}/vns/search?page=2&limit=1`);
    const dataPag28 = await resPag28.json();
    if (dataPag28.data.items.length !== 1 || dataPag28.data.items[0].id === dataPag27.data.items[0].id) {
      throw new Error('Test 28 Failed: Page 2 returned duplicate item from Page 1');
    }
    console.log('✓ Test 28: Results are correctly paginated across pages');

    // Test 29: Excessive limit is constrained (capped at 100)
    const resPag29 = await fetch(`${BASE_URL}/vns/search?limit=999999`);
    const dataPag29 = await resPag29.json();
    if (dataPag29.data.pagination.limit > 100) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Excessive limit is constrained (capped at 100)');

    // Test 30: Invalid page is handled safely
    const resPag30 = await fetch(`${BASE_URL}/vns/search?page=-5`);
    const dataPag30 = await resPag30.json();
    if (dataPag30.data.pagination.page !== 1) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: Invalid page is handled safely (defaults to page 1)');

    // Test 31: Invalid limit is handled safely
    const resPag31 = await fetch(`${BASE_URL}/vns/search?limit=invalid`);
    const dataPag31 = await resPag31.json();
    if (dataPag31.data.pagination.limit !== 20) throw new Error('Test 31 Failed');
    console.log('✓ Test 31: Invalid limit is handled safely (defaults to limit 20)');

    // Test 32: Pagination ordering is deterministic (createdAt DESC)
    const resPag32 = await fetch(`${BASE_URL}/vns/search?limit=10`);
    const items32 = (await resPag32.json()).data.items;
    if (new Date(items32[0].createdAt) < new Date(items32[items32.length - 1].createdAt)) {
      throw new Error('Test 32 Failed: Items not ordered by createdAt DESC');
    }
    console.log('✓ Test 32: Pagination ordering is deterministic (createdAt DESC)');

    // ----------------------------------------------------
    // MANDATORY SEARCH/DISCOVERY PRIVACY TESTS (Tests 33 - 35)
    // ----------------------------------------------------
    console.log('\n--- Testing Mandatory Search & Discovery Privacy Isolation ---');

    // Test 33: Unauthenticated guest searching 'secret' or 'college' gets ZERO private VNs
    const resPriv33A = await fetch(`${BASE_URL}/vns/search?q=secret`);
    const dataPriv33A = await resPriv33A.json();
    const resPriv33B = await fetch(`${BASE_URL}/vns/search?q=college`);
    const dataPriv33B = await resPriv33B.json();

    if (dataPriv33A.data.items.length !== 0 || dataPriv33B.data.items.some((i) => i.visibility === 'private')) {
      throw new Error('Test 33 Failed: Guest accessed private VN via search');
    }
    console.log('✓ Test 33: Unauthenticated guest searching gets ZERO private VNs');

    // Test 34: User B searching 'secret' or 'college' gets ZERO private VNs
    const resPriv34A = await fetch(`${BASE_URL}/vns/search?q=secret`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataPriv34A = await resPriv34A.json();
    const resPriv34B = await fetch(`${BASE_URL}/vns/search?q=college`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataPriv34B = await resPriv34B.json();

    if (dataPriv34A.data.items.length !== 0 || dataPriv34B.data.items.some((i) => i.visibility === 'private')) {
      throw new Error('Test 34 Failed: User B accessed User A\'s private VN via search');
    }
    console.log('✓ Test 34: Other user (User B) searching gets ZERO private VNs');

    // Test 35: Tag discovery for User B and guest strictly omits User A's private VN
    const resPriv35Guest = await fetch(`${BASE_URL}/vns/tags/secret`);
    const dataPriv35Guest = await resPriv35Guest.json();
    const resPriv35UserB = await fetch(`${BASE_URL}/vns/tags/secret`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataPriv35UserB = await resPriv35UserB.json();

    if (dataPriv35Guest.data.items.length !== 0 || dataPriv35UserB.data.items.length !== 0) {
      throw new Error('Test 35 Failed: Private VN tag exposed via tag discovery');
    }
    console.log('✓ Test 35: Tag discovery for User B and guest strictly omits private VNs');

    console.log('\n=== ALL 35 PHASE 6 SEARCH, TAGS & DISCOVERY TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 6 SEARCH TEST FAILED:', error);
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
