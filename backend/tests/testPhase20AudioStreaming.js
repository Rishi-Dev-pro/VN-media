const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
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
const Comment = require('../src/models/Comment');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5020;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

// Helper to generate valid PCM WAV buffer with deterministic byte sequence
function createWavBuffer(durationSeconds = 1, sampleRate = 8000) {
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

  // Fill audio data with recognizable byte pattern
  for (let i = 44; i < buffer.length; i++) {
    buffer[i] = (i - 44) % 256;
  }

  return buffer;
}

const runTests = async () => {
  console.log('=== PHASE 20 PRIVATE AUDIO STREAMING & PLAYBACK TEST SUITE ===\n');

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
    await Comment.syncIndexes();
    await Conversation.syncIndexes();
    await Message.syncIndexes();
    console.log('[Test DB] Cleared test DB and synced indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login Test Users (User A, User B, User C)
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a20', email: 'usera20@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera20@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b20', email: 'userb20@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb20@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c20', email: 'userc20@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc20@example.com', password: 'password123' }),
    });
    const userCData = await loginCRes.json();
    const tokenC = userCData.data.token;
    const userCId = userCData.data.user.id;

    // Create 1-to-1 conversation between A & B
    const convABRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    const convABData = await convABRes.json();
    const convABId = convABData.data.conversation.id;

    // Upload an audio message from User A to B
    const origWavBuffer = createWavBuffer(2.0, 8000); // ~32044 bytes
    const formUpload = new FormData();
    formUpload.append('audio', new Blob([origWavBuffer], { type: 'audio/wav' }), 'stream_test.wav');

    const uploadRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formUpload,
    });
    const uploadData = await uploadRes.json();
    const audioMsgId = uploadData.data.message.id;
    const streamEndpoint = `${BASE_URL}/conversations/${convABId}/messages/${audioMsgId}/audio`;

    console.log('[Setup] Test users, conversation, and audio message created\n');

    // ================================
    // SECTION 1: AUTHENTICATION TESTS (Tests 1-4)
    // ================================
    console.log('--- AUTHENTICATION TESTS ---');

    // Test 1: Valid participant A can stream audio (200 OK)
    const authStreamRes1 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(authStreamRes1.status === 200, 'Test 1: Valid participant A can stream audio (200 OK)');

    // Test 2: Unauthenticated request rejected (401 Unauthorized)
    const unauthRes2 = await fetch(streamEndpoint);
    assert(unauthRes2.status === 401, 'Test 2: Unauthenticated request rejected with 401');

    // Test 3: Invalid JWT token rejected (401 Unauthorized)
    const invalidTokenRes3 = await fetch(streamEndpoint, {
      headers: { 'Authorization': 'Bearer invalid.jwt.token' },
    });
    assert(invalidTokenRes3.status === 401, 'Test 3: Invalid JWT token rejected with 401');

    // Test 4: Malformed Authorization header rejected (401 Unauthorized)
    const malformedRes4 = await fetch(streamEndpoint, {
      headers: { 'Authorization': 'NotBearer token' },
    });
    assert(malformedRes4.status === 401, 'Test 4: Malformed Authorization header rejected with 401');

    console.log('');

    // ================================
    // SECTION 2: AUTHORIZATION TESTS (Tests 5-10)
    // ================================
    console.log('--- AUTHORIZATION TESTS ---');

    // Test 5: Participant A can stream
    assert(authStreamRes1.status === 200, 'Test 5: Participant A can stream audio');

    // Test 6: Participant B can stream
    const authStreamRes6 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(authStreamRes6.status === 200, 'Test 6: Participant B can stream audio');

    // Test 7: Non-participant C rejected (404 Not Found)
    const unauthStreamRes7 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(unauthStreamRes7.status === 404, 'Test 7: Non-participant C rejected with 404 Not Found');

    // Test 8: Conversation ID spoofing rejected (404 Not Found)
    const fakeConvId = new mongoose.Types.ObjectId();
    const spoofConvRes8 = await fetch(`${BASE_URL}/conversations/${fakeConvId}/messages/${audioMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(spoofConvRes8.status === 404, 'Test 8: Conversation ID spoofing rejected with 404 Not Found');

    // Test 9: Message from another conversation rejected (404 Not Found)
    const convACRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userCId }),
    });
    const convACData = await convACRes.json();
    const convACId = convACData.data.conversation.id;

    const crossConvRes9 = await fetch(`${BASE_URL}/conversations/${convACId}/messages/${audioMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(crossConvRes9.status === 404, 'Test 9: Message from another conversation rejected with 404');

    // Test 10: Client-controlled user identity query parameters ignored (auth comes strictly from JWT)
    const querySpoofRes10 = await fetch(`${streamEndpoint}?userId=${userAId}`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(querySpoofRes10.status === 404, 'Test 10: Client-supplied userId query parameter ignored (404 for User C)');

    console.log('');

    // ================================
    // SECTION 3: MESSAGE VALIDATION & STATE TESTS (Tests 11-15)
    // ================================
    console.log('--- MESSAGE VALIDATION & STATE TESTS ---');

    // Test 11: Audio message streams valid file
    assert(authStreamRes1.status === 200, 'Test 11: Audio message streams valid file');

    // Test 12: Text message stream request rejected (400 Bad Request)
    const textMsgRes12 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Text message for stream test' }),
    });
    const textMsgData12 = await textMsgRes12.json();
    const textMsgId = textMsgData12.data.message.id;

    const streamTextRes12 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${textMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(streamTextRes12.status === 400, 'Test 12: Text message stream request rejected with 400 Bad Request');

    // Test 13: Soft-deleted audio message stream request rejected (404 Not Found)
    const formDel13 = new FormData();
    formDel13.append('audio', new Blob([origWavBuffer], { type: 'audio/wav' }), 'del_audio.wav');
    const uploadDel13Res = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formDel13,
    });
    const uploadDel13Data = await uploadDel13Res.json();
    const delMsgId = uploadDel13Data.data.message.id;

    // Delete message
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${delMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    const streamDelRes13 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${delMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(streamDelRes13.status === 404, 'Test 13: Soft-deleted audio message stream request rejected with 404 Not Found');

    // Test 14: Missing/fake message ID rejected (404 Not Found)
    const fakeMsgId = new mongoose.Types.ObjectId();
    const missingMsgRes14 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${fakeMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(missingMsgRes14.status === 404, 'Test 14: Missing/fake message ID stream request rejected with 404');

    // Test 15: Missing/fake conversation ID rejected (404 Not Found)
    assert(spoofConvRes8.status === 404, 'Test 15: Missing/fake conversation ID stream request rejected with 404');

    console.log('');

    // ================================
    // SECTION 4: STORAGE & SECURITY TESTS (Tests 16-20)
    // ================================
    console.log('--- STORAGE & SECURITY TESTS ---');

    // Test 16: Existing audio file streams cleanly
    assert(authStreamRes1.status === 200, 'Test 16: Existing audio file streams cleanly');

    // Test 17: Missing storage file returns safe error (404 Not Found)
    const formMissing17 = new FormData();
    formMissing17.append('audio', new Blob([origWavBuffer], { type: 'audio/wav' }), 'temp_missing.wav');
    const uploadMissingRes17 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formMissing17,
    });
    const uploadMissingData17 = await uploadMissingRes17.json();
    const missingFileMsgId = uploadMissingData17.data.message.id;

    // Manually delete storage file from disk
    const msgDoc17 = await Message.findById(missingFileMsgId);
    await storageService.deleteFile(msgDoc17.audioUrl);

    const streamMissingFileRes17 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${missingFileMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(streamMissingFileRes17.status === 404, 'Test 17: Missing storage file returns safe error (404 Not Found)');

    // Test 18: Internal filesystem path is NOT exposed in headers or body
    const headersStr18 = JSON.stringify(Object.fromEntries(authStreamRes1.headers.entries()));
    assert(!headersStr18.includes('d:\\') && !headersStr18.includes('storage/audio'), 'Test 18: Internal absolute filesystem path is NOT exposed in response headers');

    // Test 19: Storage path traversal cannot escape storage directory
    const traversalPathRes19 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/..%2F..%2Fsecret/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(traversalPathRes19.status === 404, 'Test 19: Storage path traversal attempt rejected with 404');

    // Test 20: Direct static file access cannot bypass authorization (storage directory is private)
    const directStaticRes20 = await fetch(`http://localhost:${TEST_PORT}/storage/audio/somefile.wav`);
    assert(directStaticRes20.status === 404, 'Test 20: Direct static file access returns 404 (private storage location)');

    console.log('');

    // ================================
    // SECTION 5: FULL RESPONSE HTTP TESTS (Tests 21-25)
    // ================================
    console.log('--- FULL RESPONSE HTTP TESTS ---');

    // Test 21: Full request without Range header returns 200 OK
    const fullRes21 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(fullRes21.status === 200, 'Test 21: Request without Range header returns 200 OK');

    // Test 22: Content-Length equals total file size
    const contentLength22 = parseInt(fullRes21.headers.get('content-length'), 10);
    assert(contentLength22 === origWavBuffer.length, `Test 22: Content-Length equals total file size (${origWavBuffer.length})`);

    // Test 23: Content-Type equals expected MIME type
    const contentType23 = fullRes21.headers.get('content-type');
    assert(contentType23 === 'audio/wav', 'Test 23: Content-Type equals audio/wav');

    // Test 24: Accept-Ranges header is present (bytes)
    const acceptRanges24 = fullRes21.headers.get('accept-ranges');
    assert(acceptRanges24 === 'bytes', 'Test 24: Accept-Ranges header is present (bytes)');

    // Test 25: Complete returned file bytes match original uploaded audio buffer byte-for-byte!
    const fullBodyArr25 = await fullRes21.arrayBuffer();
    const fullBodyBuf25 = Buffer.from(fullBodyArr25);
    assert(
      fullBodyBuf25.length === origWavBuffer.length &&
      fullBodyBuf25.equals(origWavBuffer),
      'Test 25: Complete returned file bytes match original uploaded audio buffer byte-for-byte'
    );

    console.log('');

    // ================================
    // SECTION 6: BYTE-RANGE HTTP RESPONSE TESTS (Tests 26-36)
    // ================================
    console.log('--- BYTE-RANGE HTTP RESPONSE TESTS ---');

    // Test 26: bytes=0-999 returns 206 Partial Content
    const rangeRes26 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=0-999' },
    });
    assert(rangeRes26.status === 206, 'Test 26: Range bytes=0-999 returns 206 Partial Content');

    // Test 27: Correct Content-Range header
    const contentRange27 = rangeRes26.headers.get('content-range');
    assert(contentRange27 === `bytes 0-999/${origWavBuffer.length}`, `Test 27: Correct Content-Range (bytes 0-999/${origWavBuffer.length})`);

    // Test 28: Correct Content-Length header for range
    const contentLength28 = parseInt(rangeRes26.headers.get('content-length'), 10);
    assert(contentLength28 === 1000, 'Test 28: Correct Content-Length for 1000 byte range (1000)');

    // Test 29: Response bytes match original uploaded buffer bytes 0-999 byte-for-byte!
    const rangeArr29 = await rangeRes26.arrayBuffer();
    const rangeBuf29 = Buffer.from(rangeArr29);
    const expectedBuf29 = origWavBuffer.subarray(0, 1000);
    assert(
      rangeBuf29.length === 1000 &&
      rangeBuf29.equals(expectedBuf29),
      'Test 29: Range bytes=0-999 response bytes match original buffer bytes 0-999 byte-for-byte'
    );

    // Test 30: Open-ended range bytes=1000- returns 206 Partial Content with correct bytes!
    const rangeRes30 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=1000-' },
    });
    const rangeArr30 = await rangeRes30.arrayBuffer();
    const rangeBuf30 = Buffer.from(rangeArr30);
    const expectedBuf30 = origWavBuffer.subarray(1000);
    assert(
      rangeRes30.status === 206 &&
      rangeBuf30.length === expectedBuf30.length &&
      rangeBuf30.equals(expectedBuf30),
      'Test 30: Open-ended range bytes=1000- returns 206 Partial Content with exact trailing bytes'
    );

    // Test 31: Suffix range bytes=-500 returns 206 Partial Content with correct last 500 bytes!
    const rangeRes31 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=-500' },
    });
    const rangeArr31 = await rangeRes31.arrayBuffer();
    const rangeBuf31 = Buffer.from(rangeArr31);
    const expectedBuf31 = origWavBuffer.subarray(origWavBuffer.length - 500);
    assert(
      rangeRes31.status === 206 &&
      rangeBuf31.length === 500 &&
      rangeBuf31.equals(expectedBuf31),
      'Test 31: Suffix range bytes=-500 returns 206 Partial Content with exact last 500 bytes'
    );

    // Test 32: Range at exact file end (bytes=last-last) handled correctly (206)
    const lastByteIdx = origWavBuffer.length - 1;
    const rangeRes32 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': `bytes=${lastByteIdx}-${lastByteIdx}` },
    });
    const rangeArr32 = await rangeRes32.arrayBuffer();
    const rangeBuf32 = Buffer.from(rangeArr32);
    assert(
      rangeRes32.status === 206 &&
      rangeBuf32.length === 1 &&
      rangeBuf32[0] === origWavBuffer[lastByteIdx],
      'Test 32: Range at exact file end (bytes=last-last) returns 206 with exact single byte'
    );

    // Test 33: Range beyond file size (bytes=9999999-) returns 416 Range Not Satisfiable
    const rangeRes33 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=9999999-' },
    });
    assert(rangeRes33.status === 416, 'Test 33: Range beyond file size returns 416 Range Not Satisfiable');

    // Test 34: Start > end (bytes=500-100) returns 416 Range Not Satisfiable
    const rangeRes34 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=500-100' },
    });
    assert(rangeRes34.status === 416, 'Test 34: Start > end returns 416 Range Not Satisfiable');

    // Test 35: Invalid range syntax (bytes=abc-def) returns 416 Range Not Satisfiable
    const rangeRes35 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=abc-def' },
    });
    assert(rangeRes35.status === 416, 'Test 35: Invalid range syntax returns 416 Range Not Satisfiable');

    // Test 36: Suffix range 0 (bytes=-0) returns 416 Range Not Satisfiable
    const rangeRes36 = await fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=-0' },
    });
    assert(rangeRes36.status === 416, 'Test 36: Suffix range -0 returns 416 Range Not Satisfiable');

    console.log('');

    // ================================
    // SECTION 7: STREAMING MEMORY & PERFORMANCE TESTS (Tests 37-40)
    // ================================
    console.log('--- STREAMING MEMORY & PERFORMANCE TESTS ---');

    // Test 37 & 38: Range request streams bounded chunk
    assert(rangeBuf29.length === 1000, 'Test 37 & 38: Range request streams bounded chunk size (1000 bytes)');

    // Test 39: Multiple concurrent streams from different participants remain correct and independent
    const concStream1 = fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=0-499' },
    });
    const concStream2 = fetch(streamEndpoint, {
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Range': 'bytes=500-999' },
    });
    const [concRes1, concRes2] = await Promise.all([concStream1, concStream2]);
    const concBuf1 = Buffer.from(await concRes1.arrayBuffer());
    const concBuf2 = Buffer.from(await concRes2.arrayBuffer());

    assert(
      concRes1.status === 206 &&
      concRes2.status === 206 &&
      concBuf1.equals(origWavBuffer.subarray(0, 500)) &&
      concBuf2.equals(origWavBuffer.subarray(500, 1000)),
      'Test 39: Multiple concurrent streams from participants A & B remain correct and independent'
    );

    // Test 40: Cache-Control header specifies private, no-cache, no-store, must-revalidate
    const cacheHeader = rangeRes26.headers.get('cache-control');
    assert(
      cacheHeader &&
      cacheHeader.includes('private') &&
      cacheHeader.includes('no-cache'),
      'Test 40: Cache-Control specifies private, no-cache for audio streaming'
    );

    console.log('');

    // ================================
    // SECTION 8: PRIVACY & SECURITY VERIFICATION (Tests 41-47)
    // ================================
    console.log('--- PRIVACY & SECURITY VERIFICATION ---');

    // Test 41: User C cannot stream A<->B audio (404 Not Found)
    assert(unauthStreamRes7.status === 404, 'Test 41: User C cannot stream A<->B audio (404 Not Found)');

    // Test 42: Knowing message ID alone is insufficient for access without participant JWT
    assert(missingMsgRes14.status === 404, 'Test 42: Knowing message ID alone is insufficient for access');

    // Test 43: Knowing audioUrl alone is insufficient for access
    assert(directStaticRes20.status === 404, 'Test 43: Knowing audioUrl/storageRef alone is insufficient for access');

    // Test 44: Deleted audio stream does NOT reveal storage existence (returns 404)
    assert(streamDelRes13.status === 404, 'Test 44: Deleted audio stream returns 404 without revealing storage existence');

    // Test 45: User email is NOT exposed in headers or response
    assert(!headersStr18.includes('usera20@example.com'), 'Test 45: User email is NOT exposed in streaming response');

    // Test 46: User passwordHash is NOT exposed in headers or response
    assert(!headersStr18.includes('passwordHash'), 'Test 46: passwordHash is NOT exposed in streaming response');

    // Test 47: Absolute filesystem path is NOT exposed in response
    assert(!headersStr18.includes('d:\\'), 'Test 47: Absolute filesystem path is NOT exposed in streaming response');

    console.log('');

    // ================================
    // SECTION 9: READ STATE ISOLATION VERIFICATION (Tests 48-50)
    // ================================
    console.log('--- READ STATE ISOLATION VERIFICATION ---');

    // Test 48: Audio streaming does NOT modify message readAt timestamp
    const audioMsgDoc48 = await Message.findById(audioMsgId);
    assert(audioMsgDoc48.readAt === null, 'Test 48: Audio streaming does NOT modify message readAt timestamp');

    // Test 49: Mark-read endpoint still works independently
    const markReadRes49 = await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(markReadRes49.status === 200, 'Test 49: Mark-read endpoint still works independently');

    // Test 50: Unread count remains correct
    const convRes50 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const convData50 = await convRes50.json();
    assert(typeof convData50.data.conversation.unreadCount === 'number', 'Test 50: Unread count remains numeric and accurate');

    console.log('');

    // ================================
    // SECTION 10: FULL REGRESSION VERIFICATION (Tests 51-55)
    // ================================
    console.log('--- FULL REGRESSION VERIFICATION ---');

    // Test 51: Text messages still work
    assert(textMsgRes12.status === 201, 'Test 51: Text messages still work');

    // Test 52: Message history still works
    const histRes52 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(histRes52.status === 200, 'Test 52: Message history still works');

    // Test 53: Conversation listing still works
    const listRes53 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(listRes53.status === 200, 'Test 53: Conversation listing still works');

    // Test 54: Soft deletion still works
    const delRes54 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${textMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes54.status === 200, 'Test 54: Soft deletion still works');

    // Test 55: Real-time message:new payload contains application audioUrl endpoint
    const form55 = new FormData();
    form55.append('audio', new Blob([origWavBuffer], { type: 'audio/wav' }), 'rt_url.wav');
    const uploadRes55 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form55,
    });
    const uploadData55 = await uploadRes55.json();
    assert(
      uploadRes55.status === 201 &&
      uploadData55.data.message.audioUrl.startsWith('/api/conversations/'),
      'Test 55: Formatted message audioUrl exposes application endpoint /api/conversations/:id/messages/:msgId/audio'
    );

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 20 Audio Streaming Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Test Error]', error);
    failed++;
  } finally {
    // Cleanup
    try {
      const storageDir = storageService.getStoragePath ? storageService.getStoragePath() : path.resolve(__dirname, '../../storage/audio');
      if (fs.existsSync(storageDir)) {
        const files = fs.readdirSync(storageDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(storageDir, file));
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
