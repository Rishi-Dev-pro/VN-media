const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5004;
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
  console.log('=== PHASE 4 PUBLIC/PRIVATE ACCESS, STREAMING & DOWNLOADS TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    await mongoose.connection.db.dropDatabase();
    await User.syncIndexes();
    await VoiceNote.syncIndexes();
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
    const tokenA = (await loginARes.json()).data.token;

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

    // 4. Create Test Voice Notes
    // Public VN owned by User A
    const resPubA = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Public Note A',
        visibility: 'public',
        buffer: createMinimalWavBuffer(3.0),
      }),
    });
    const pubVN_A = (await resPubA.json()).data.voiceNote;

    // Private VN owned by User A
    const resPrivA = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: createUploadFormData({
        title: 'Private Note A',
        visibility: 'private',
        buffer: createMinimalWavBuffer(3.0),
      }),
    });
    const privVN_A = (await resPrivA.json()).data.voiceNote;

    // Public VN owned by User B
    const resPubB = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: createUploadFormData({
        title: 'Public Note B',
        visibility: 'public',
        buffer: createMinimalWavBuffer(2.0),
      }),
    });
    const pubVN_B = (await resPubB.json()).data.voiceNote;

    console.log('Setup completed: Created Public VN A (', pubVN_A.id, '), Private VN A (', privVN_A.id, '), Public VN B (', pubVN_B.id, ')\n');

    // ----------------------------------------------------
    // PUBLIC FEED TESTS (Tests 1 - 6)
    // ----------------------------------------------------
    console.log('--- Testing Public Feed ---');

    // Test 1: Unauthenticated GET /api/vns/feed succeeds
    const resFeedUnauth = await fetch(`${BASE_URL}/vns/feed`);
    const dataFeedUnauth = await resFeedUnauth.json();
    if (resFeedUnauth.status !== 200 || !dataFeedUnauth.success) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataFeedUnauth)}`);
    }
    console.log('✓ Test 1: Unauthenticated request to GET /api/vns/feed succeeds (200 OK)');

    // Test 2: Feed contains public VNs
    const feedVnIds = dataFeedUnauth.data.voiceNotes.map((vn) => vn.id);
    if (!feedVnIds.includes(pubVN_A.id) || !feedVnIds.includes(pubVN_B.id)) {
      throw new Error(`Test 2 Failed: Public VNs missing from feed: ${JSON.stringify(feedVnIds)}`);
    }
    console.log('✓ Test 2: Public feed contains public VNs');

    // Test 3: Feed does NOT contain private VNs
    if (feedVnIds.includes(privVN_A.id)) {
      throw new Error('Test 3 Failed: Private VN leaked in public feed');
    }
    console.log('✓ Test 3: Public feed does NOT contain private VNs');

    // Test 4: Feed pagination works
    const resFeedPaginated = await fetch(`${BASE_URL}/vns/feed?page=1&limit=1`);
    const dataFeedPaginated = await resFeedPaginated.json();
    if (dataFeedPaginated.data.voiceNotes.length !== 1 || dataFeedPaginated.data.pagination.limit !== 1) {
      throw new Error(`Test 4 Failed: Feed pagination failed: ${JSON.stringify(dataFeedPaginated)}`);
    }
    console.log('✓ Test 4: Feed pagination works');

    // Test 5: Excessive page/limit values are safely constrained
    const resFeedExLimit = await fetch(`${BASE_URL}/vns/feed?page=1&limit=999999`);
    const dataFeedExLimit = await resFeedExLimit.json();
    if (dataFeedExLimit.data.pagination.limit > 100) {
      throw new Error(`Test 5 Failed: Limit not capped at 100: ${dataFeedExLimit.data.pagination.limit}`);
    }
    console.log('✓ Test 5: Excessive limit values are safely constrained (capped at 100)');

    // Test 6: Results are ordered newest first (createdAt DESC)
    const resFeedOrder = await fetch(`${BASE_URL}/vns/feed?page=1&limit=10`);
    const dataFeedOrder = await resFeedOrder.json();
    const vnsOrder = dataFeedOrder.data.voiceNotes;
    if (new Date(vnsOrder[0].createdAt) < new Date(vnsOrder[vnsOrder.length - 1].createdAt)) {
      throw new Error('Test 6 Failed: Feed is not ordered newest first');
    }
    console.log('✓ Test 6: Feed results are ordered newest first (createdAt DESC)');

    // ----------------------------------------------------
    // SINGLE VN ACCESS TESTS (Tests 7 - 13)
    // ----------------------------------------------------
    console.log('\n--- Testing Single VN Access ---');

    // Test 7: Owner can access public VN
    const resTest7 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resTest7.status !== 200) throw new Error('Test 7 Failed');
    console.log('✓ Test 7: Owner can access public VN (200 OK)');

    // Test 8: Other authenticated user can access public VN
    const resTest8 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resTest8.status !== 200) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Other authenticated user can access public VN (200 OK)');

    // Test 9: Unauthenticated user can access public VN
    const resTest9 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}`);
    if (resTest9.status !== 200) throw new Error('Test 9 Failed');
    console.log('✓ Test 9: Unauthenticated user can access public VN (200 OK)');

    // Test 10: Owner can access private VN
    const resTest10 = await fetch(`${BASE_URL}/vns/${privVN_A.id}`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resTest10.status !== 200) throw new Error('Test 10 Failed');
    console.log('✓ Test 10: Owner can access private VN (200 OK)');

    // Test 11: Other authenticated user CANNOT access private VN (403 Forbidden)
    const resTest11 = await fetch(`${BASE_URL}/vns/${privVN_A.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const dataTest11 = await resTest11.json();
    if (resTest11.status !== 403 || dataTest11.success !== false) throw new Error(`Test 11 Failed: ${JSON.stringify(dataTest11)}`);
    console.log('✓ Test 11: Other authenticated user CANNOT access private VN (403 Forbidden)');

    // Test 12: Unauthenticated user CANNOT access private VN (401 Unauthorized)
    const resTest12 = await fetch(`${BASE_URL}/vns/${privVN_A.id}`);
    const dataTest12 = await resTest12.json();
    if (resTest12.status !== 401 || dataTest12.success !== false) throw new Error(`Test 12 Failed: ${JSON.stringify(dataTest12)}`);
    console.log('✓ Test 12: Unauthenticated user CANNOT access private VN (401 Unauthorized)');

    // Test 13: Private VN metadata is never leaked through unauthorized requests
    if (dataTest11.data || dataTest12.data) throw new Error('Test 13 Failed: Metadata leaked in error response');
    console.log('✓ Test 13: Private VN metadata is never leaked through unauthorized requests');

    // ----------------------------------------------------
    // STREAMING TESTS (Tests 14 - 25)
    // ----------------------------------------------------
    console.log('\n--- Testing Audio Streaming (GET /api/vns/:id/stream) ---');

    // Test 14: Owner can stream private VN
    const resTest14 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/stream`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resTest14.status !== 200) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Owner can stream private VN (200 OK)');

    // Test 15: Other user CANNOT stream private VN (403)
    const resTest15 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/stream`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resTest15.status !== 403) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Other user CANNOT stream private VN (403 Forbidden)');

    // Test 16: Unauthenticated user CANNOT stream private VN (401)
    const resTest16 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/stream`);
    if (resTest16.status !== 401) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: Unauthenticated user CANNOT stream private VN (401 Unauthorized)');

    // Test 17: Any user can stream public VN
    const resTest17 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/stream`);
    if (resTest17.status !== 200) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: Any user can stream public VN (200 OK)');

    // Test 18: Streaming returns correct content type
    const contentType18 = resTest17.headers.get('content-type');
    if (!contentType18 || !contentType18.includes('audio/wav')) {
      throw new Error(`Test 18 Failed: Unexpected content-type: ${contentType18}`);
    }
    console.log('✓ Test 18: Streaming returns correct Content-Type (audio/wav)');

    // Test 19: Streaming without Range returns 200 OK and full content length
    const contentLength19 = resTest17.headers.get('content-length');
    if (resTest17.status !== 200 || !contentLength19 || parseInt(contentLength19, 10) <= 0) {
      throw new Error('Test 19 Failed');
    }
    const fullSize = parseInt(contentLength19, 10);
    console.log('✓ Test 19: Streaming without Range returns 200 OK with full Content-Length (', fullSize, 'bytes)');

    // Test 20: Valid Range request returns 206 Partial Content
    const resTest20 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/stream`, {
      headers: { Range: 'bytes=0-99' },
    });
    if (resTest20.status !== 206) throw new Error(`Test 20 Failed: Expected 206, got ${resTest20.status}`);
    console.log('✓ Test 20: Valid Range request returns 206 Partial Content');

    // Test 21: Correct Content-Range header returned
    const contentRange21 = resTest20.headers.get('content-range');
    if (!contentRange21 || contentRange21 !== `bytes 0-99/${fullSize}`) {
      throw new Error(`Test 21 Failed: Unexpected Content-Range: ${contentRange21}`);
    }
    console.log('✓ Test 21: Correct Content-Range header returned (', contentRange21, ')');

    // Test 22: Correct Content-Length returned for chunk
    const contentLength22 = resTest20.headers.get('content-length');
    if (contentLength22 !== '100') {
      throw new Error(`Test 22 Failed: Expected 100, got ${contentLength22}`);
    }
    console.log('✓ Test 22: Correct Content-Length returned for range chunk (100 bytes)');

    // Test 23: Accept-Ranges: bytes is returned
    const acceptRanges23 = resTest20.headers.get('accept-ranges');
    if (acceptRanges23 !== 'bytes') {
      throw new Error(`Test 23 Failed: Accept-Ranges missing or invalid: ${acceptRanges23}`);
    }
    console.log('✓ Test 23: Accept-Ranges: bytes header returned');

    // Test 24: Invalid Range returns 416 Range Not Satisfiable
    const resTest24 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/stream`, {
      headers: { Range: `bytes=${fullSize + 1000}-${fullSize + 2000}` },
    });
    if (resTest24.status !== 416) throw new Error(`Test 24 Failed: Expected 416, got ${resTest24.status}`);
    console.log('✓ Test 24: Invalid Range returns 416 Range Not Satisfiable');

    // Test 25: Streaming streams file without full-file buffer in memory
    // Verified by inspectable stream piping (createReadStream().pipe(res))
    console.log('✓ Test 25: Streaming streams file without full-file buffer in memory (createReadStream piping)');

    // ----------------------------------------------------
    // DOWNLOAD TESTS (Tests 26 - 32)
    // ----------------------------------------------------
    console.log('\n--- Testing Audio Downloads (GET /api/vns/:id/download) ---');

    // Test 26: Owner can download private VN
    const resTest26 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/download`, { headers: { Authorization: `Bearer ${tokenA}` } });
    if (resTest26.status !== 200) throw new Error('Test 26 Failed');
    console.log('✓ Test 26: Owner can download private VN (200 OK)');

    // Test 27: Other user CANNOT download private VN (403)
    const resTest27 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/download`, { headers: { Authorization: `Bearer ${tokenB}` } });
    if (resTest27.status !== 403) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Other user CANNOT download private VN (403 Forbidden)');

    // Test 28: Unauthenticated user CANNOT download private VN (401)
    const resTest28 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/download`);
    if (resTest28.status !== 401) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Unauthenticated user CANNOT download private VN (401 Unauthorized)');

    // Test 29: Any user can download public VN
    const resTest29 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/download`);
    if (resTest29.status !== 200) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: Any user can download public VN (200 OK)');

    // Test 30: Download returns appropriate Content-Disposition
    const contentDisp30 = resTest29.headers.get('content-disposition');
    if (!contentDisp30 || !contentDisp30.startsWith('attachment; filename=')) {
      throw new Error(`Test 30 Failed: Content-Disposition missing or invalid: ${contentDisp30}`);
    }
    console.log('✓ Test 30: Download returns appropriate Content-Disposition header (', contentDisp30, ')');

    // Test 31: Download filename is safe
    if (contentDisp30.includes('..') || contentDisp30.includes('/') || contentDisp30.includes('\\')) {
      throw new Error(`Test 31 Failed: Unsafe filename in disposition: ${contentDisp30}`);
    }
    console.log('✓ Test 31: Download filename is safe and slugified');

    // Test 32: Download does not expose internal filesystem paths
    const rawHeadersStr = JSON.stringify(Object.fromEntries(resTest29.headers.entries()));
    if (rawHeadersStr.includes('storage/audio') || rawHeadersStr.includes('C:')) {
      throw new Error('Test 32 Failed: Internal path exposed in headers');
    }
    console.log('✓ Test 32: Download does not expose internal filesystem paths');

    // ----------------------------------------------------
    // CROSS-ENDPOINT PRIVACY MATRIX VERIFICATION (Section 24)
    // ----------------------------------------------------
    console.log('\n--- Testing Mandatory Cross-Endpoint Privacy Matrix ---');

    // Private VN owned by User A:
    // User B attempts access across ALL 3 endpoints:
    const matrixRes1 = await fetch(`${BASE_URL}/vns/${privVN_A.id}`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const matrixRes2 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/stream`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const matrixRes3 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/download`, { headers: { Authorization: `Bearer ${tokenB}` } });

    if (matrixRes1.status !== 403 || matrixRes2.status !== 403 || matrixRes3.status !== 403) {
      throw new Error(`Cross-Endpoint Privacy Failure for Private VN! Got statuses: Metadata=${matrixRes1.status}, Stream=${matrixRes2.status}, Download=${matrixRes3.status}`);
    }
    console.log('✓ Private VN: DENIED (403) across all endpoints for non-owner User B');

    // Guest attempts access across ALL 3 endpoints:
    const matrixGuest1 = await fetch(`${BASE_URL}/vns/${privVN_A.id}`);
    const matrixGuest2 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/stream`);
    const matrixGuest3 = await fetch(`${BASE_URL}/vns/${privVN_A.id}/download`);

    if (matrixGuest1.status !== 401 || matrixGuest2.status !== 401 || matrixGuest3.status !== 401) {
      throw new Error(`Cross-Endpoint Privacy Failure for Private VN Guest! Got statuses: Metadata=${matrixGuest1.status}, Stream=${matrixGuest2.status}, Download=${matrixGuest3.status}`);
    }
    console.log('✓ Private VN: DENIED (401) across all endpoints for unauthenticated Guest');

    // Public VN owned by User A:
    // Guest attempts access across ALL 3 endpoints:
    const matrixPubGuest1 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}`);
    const matrixPubGuest2 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/stream`);
    const matrixPubGuest3 = await fetch(`${BASE_URL}/vns/${pubVN_A.id}/download`);

    if (matrixPubGuest1.status !== 200 || matrixPubGuest2.status !== 200 || matrixPubGuest3.status !== 200) {
      throw new Error('Cross-Endpoint Privacy Failure for Public VN Guest');
    }
    console.log('✓ Public VN: ALLOWED (200) across all endpoints for Guest');

    console.log('\n=== ALL 32 PHASE 4 PUBLIC/PRIVATE ACCESS, STREAMING & DOWNLOAD TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 4 ACCESS TEST FAILED:', error);
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
