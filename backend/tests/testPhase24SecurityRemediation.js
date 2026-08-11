const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Album = require('../src/models/Album');
const Comment = require('../src/models/Comment');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const Download = require('../src/models/Download');
const ActivityEvent = require('../src/models/ActivityEvent');
const storageService = require('../src/services/storage.service');
const voiceNoteService = require('../src/services/voiceNote.service');
const activityEventService = require('../src/services/activityEvent.service');
const { AuthService } = require('../src/services/auth.service');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const { MemoryRateLimiter } = require('../src/middleware/rateLimiter');
const LocalStorageProvider = require('../src/providers/storage/LocalStorageProvider');

let server;
let BASE_URL;
let passed = 0;
let failed = 0;

// Helper function to create a minimal valid WAV buffer
function createMinimalWavBuffer(durationSeconds = 1) {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = Math.floor(sampleRate * numChannels * (bitsPerSample / 8) * durationSeconds);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

// Helper to construct FormData for audio upload
function createUploadFormData({ title = 'Test VN', visibility = 'public', buffer }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('visibility', visibility);
  const audioBlob = new Blob([buffer || createMinimalWavBuffer(1)], { type: 'audio/wav' });
  formData.append('audio', audioBlob, 'test_audio.wav');
  return formData;
}

const runTests = async () => {
  console.log('=== PHASE 24 SECURITY REMEDIATION & INTEGRITY HARDENING TEST SUITE ===\n');

  try {
    // 1. Database & Server Setup
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const testDbUri = config.mongodbUri.includes('test')
      ? config.mongodbUri
      : config.mongodbUri.replace(/\/([^\/]+)$/, '/vn_platform_test_p24');

    await mongoose.connect(testDbUri);
    console.log('[Test DB] Connected to isolated test database:', mongoose.connection.name);

    await mongoose.connection.db.dropDatabase();
    await User.syncIndexes();
    await VoiceNote.syncIndexes();
    await Album.syncIndexes();
    await Conversation.syncIndexes();
    await Message.syncIndexes();
    await Download.syncIndexes();
    await ActivityEvent.syncIndexes();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    BASE_URL = `http://localhost:${port}/api`;
    console.log(`[Test Server] Running on port ${port}\n`);

    // 2. Setup Test Identities
    const userA = await User.create({
      username: 'user_p24_a',
      email: 'user_p24_a@example.com',
      passwordHash: 'hash_a',
    });
    const tokenA = generateToken(userA._id, userA.tokenVersion || 0);

    const userB = await User.create({
      username: 'user_p24_b',
      email: 'user_p24_b@example.com',
      passwordHash: 'hash_b',
    });
    const tokenB = generateToken(userB._id, userB.tokenVersion || 0);

    // ================================================
    // REMEDIATION 1: VOICENOTE DATABASE / STORAGE INTEGRITY
    // ================================================
    console.log('--- REMEDIATION 1: VOICENOTE INTEGRITY & FAILURE SAFETY ---');

    // Test 1: Successful VoiceNote creation creates audio, DB doc, and ActivityEvent
    const form1 = createUploadFormData({ title: 'Integrity Test VN 1', visibility: 'public' });
    const res1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: form1,
    });
    const data1 = await res1.json();
    assert(res1.status === 201 && data1.success, 'Test 1: VoiceNote creation succeeds (201 Created)');
    const vn1Id = data1.data.voiceNote.id;
    const vn1Doc = await VoiceNote.findById(vn1Id);
    assert(vn1Doc && (await storageService.fileExists(vn1Doc.audioUrl)), 'Test 1: VoiceNote doc and storage file exist');
    const actEvent1 = await ActivityEvent.findOne({ targetId: vn1Id });
    assert(actEvent1 !== null, 'Test 1: ActivityEvent created for public VoiceNote');
    passed++;
    console.log('✓ Test 1: Successful VoiceNote creation creates audio, DB doc, and ActivityEvent');

    // Test 2: VoiceNote creation failure rolls back audio file without orphans
    const origCreate = VoiceNote.create;
    VoiceNote.create = async () => {
      throw new Error('Simulated Database Failure');
    };
    let dbFailCaught = false;
    let savedStorageRef = null;
    const origSaveFile = storageService.saveFile.bind(storageService);
    storageService.saveFile = async (...args) => {
      const res = await origSaveFile(...args);
      savedStorageRef = res.storageRef;
      return res;
    };

    try {
      const form2 = createUploadFormData({ title: 'Failed VN' });
      await voiceNoteService.createVoiceNote({
        user: userA,
        file: { buffer: createMinimalWavBuffer(1), originalname: 'test.wav', mimetype: 'audio/wav' },
        title: 'Failed VN',
        visibility: 'public',
      });
    } catch (err) {
      if (err.message === 'Simulated Database Failure') dbFailCaught = true;
    } finally {
      VoiceNote.create = origCreate;
      storageService.saveFile = origSaveFile;
    }

    assert(dbFailCaught && savedStorageRef, 'Test 2: Database failure triggered');
    const fileExists2 = await storageService.fileExists(savedStorageRef);
    assert(!fileExists2, 'Test 2: Stored audio file deleted on DB failure');
    passed++;
    console.log('✓ Test 2: Database failure during VoiceNote creation cleans up stored audio file');

    // Test 3: ActivityEvent failure does NOT corrupt successfully created VoiceNote or delete audio file
    const origCreateAct = activityEventService.createActivityEvent;
    activityEventService.createActivityEvent = async () => {
      throw new Error('Simulated ActivityEvent Failure');
    };

    let vn3Res;
    try {
      const form3 = createUploadFormData({ title: 'ActivityEvent Fail VN', visibility: 'public' });
      vn3Res = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
        body: form3,
      });
    } finally {
      activityEventService.createActivityEvent = origCreateAct;
    }

    const vn3Data = await vn3Res.json();
    assert(vn3Res.status === 201 && vn3Data.success, 'Test 3: VoiceNote creation succeeds despite ActivityEvent failure');
    const vn3Doc = await VoiceNote.findById(vn3Data.data.voiceNote.id);
    assert(vn3Doc && (await storageService.fileExists(vn3Doc.audioUrl)), 'Test 3: VoiceNote and audio file remain fully intact');
    passed++;
    console.log('✓ Test 3: ActivityEvent failure does not corrupt VoiceNote or delete audio file');

    console.log('');

    // ================================================
    // REMEDIATION 2: DOWNLOAD STATUS STATE-MACHINE HARDENING
    // ================================================
    console.log('--- REMEDIATION 2: DOWNLOAD STATE-MACHINE & ACCESS CONTROL ---');

    // Test 4: Initiate download record
    const dlInitRes = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: vn1Id, deviceId: 'device1' }),
    });
    const dlInitData = await dlInitRes.json();
    assert(dlInitRes.status === 201 && dlInitData.data.download.status === 'pending', 'Test 4: Initiate download record (pending)');
    const dlRecordId = dlInitData.data.download.id;
    passed++;
    console.log('✓ Test 4: Initiate download tracking record (status = pending)');

    // Test 5: Valid transitions pending -> active -> completed
    const patchActive = await fetch(`${BASE_URL}/downloads/${dlRecordId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    assert(patchActive.status === 200, 'Test 5: pending -> active transition allowed');

    const patchComp = await fetch(`${BASE_URL}/downloads/${dlRecordId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert(patchComp.status === 200, 'Test 5: active -> completed transition allowed');
    passed++;
    console.log('✓ Test 5: Valid status transitions (pending -> active -> completed) succeed');

    // Test 6: Terminal revoked state cannot be un-revoked by client PATCH
    const dlDoc = await Download.findById(dlRecordId);
    dlDoc.status = 'revoked';
    await dlDoc.save();

    const patchUnrevoke = await fetch(`${BASE_URL}/downloads/${dlRecordId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert(patchUnrevoke.status === 400, 'Test 6: Transitioning from revoked to completed rejected with 400');
    const dlDocAfter = await Download.findById(dlRecordId);
    assert(dlDocAfter.status === 'revoked', 'Test 6: Download record remains revoked');
    passed++;
    console.log('✓ Test 6: Client cannot un-revoke a revoked download record (400 Bad Request)');

    // Test 7: Soft-deleting VoiceNote causes dynamic authorization re-evaluation to revoke access
    const dlInitB = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: vn1Id, deviceId: 'device2' }),
    });
    const dlInitBData = await dlInitB.json();
    const dlRecordBId = dlInitBData.data.download.id;

    // Soft-delete VoiceNote
    await fetch(`${BASE_URL}/vns/${vn1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const patchDeleted = await fetch(`${BASE_URL}/downloads/${dlRecordBId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    assert(patchDeleted.status === 404 || patchDeleted.status === 403, 'Test 7: Access re-evaluation fails on deleted VoiceNote');
    const dlBAfter = await Download.findById(dlRecordBId);
    assert(dlBAfter.status === 'revoked' && dlBAfter.downloadUrl === null, 'Test 7: Download status updated to revoked');
    passed++;
    console.log('✓ Test 7: Soft-deleted VoiceNote access re-evaluation transitions download to revoked');

    console.log('');

    // ================================================
    // REMEDIATION 3: BOUNDED MEMORY RATE LIMITER
    // ================================================
    console.log('--- REMEDIATION 3: BOUNDED MEMORY RATE LIMITER ---');

    // Test 8: Rate limiter caps max keys and auto-prunes
    const testLimiter = new MemoryRateLimiter(60000, 10, 'Limit exceeded', 3);
    const middleware = testLimiter.getMiddleware();

    for (let i = 0; i < 5; i++) {
      const dummyReq = { ip: `10.0.0.${i}`, path: '/test', baseUrl: '/api', body: {} };
      const dummyRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
      middleware(dummyReq, dummyRes, () => {});
    }

    assert(testLimiter.hits.size <= 3, 'Test 8: Rate limiter Map size strictly bounded to maxKeys (3)');
    passed++;
    console.log('✓ Test 8: Rate limiter Map size strictly bounded to maxKeys');

    // Test 9: Identity-aware key construction uses req.user._id for authenticated requests
    let keyCaptured = null;
    const keyReq = { user: { _id: 'user_123' }, ip: '1.2.3.4', path: '/feed', baseUrl: '/api', body: {} };
    const keyRes = { setHeader: () => {}, status: () => ({ json: () => {} }) };
    const trackerLimiter = new MemoryRateLimiter(60000, 10, 'Limit', 100);
    trackerLimiter.getMiddleware()(keyReq, keyRes, () => {});

    for (const k of trackerLimiter.hits.keys()) {
      keyCaptured = k;
    }
    assert(keyCaptured && keyCaptured.startsWith('usr:user_123'), 'Test 9: Authenticated key uses usr:userId prefix');
    passed++;
    console.log('✓ Test 9: Authenticated requests use userId in rate limiter key');

    console.log('');

    // ================================================
    // REMEDIATION 4: JWT SESSION SECURITY & TOKEN VERSIONING
    // ================================================
    console.log('--- REMEDIATION 4: JWT & SESSION REVOCATION ---');

    // Test 10: Generated token includes tokenVersion and HS256 algorithm
    const tok10 = generateToken(userA._id, 1);
    const decoded10 = jwt.decode(tok10, { complete: true });
    assert(decoded10.header.alg === 'HS256', 'Test 10: Token header uses HS256 algorithm');
    assert(decoded10.payload.tokenVersion === 1, 'Test 10: Token payload contains tokenVersion');
    passed++;
    console.log('✓ Test 10: JWT payload contains tokenVersion and header specifies HS256');

    // Test 11: Revoking session by incrementing user.tokenVersion invalidates old token
    userA.tokenVersion = 2;
    await userA.save();

    const oldTokRes = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${tok10}` },
    });
    assert(oldTokRes.status === 401, 'Test 11: Token with mismatched tokenVersion rejected with 401');

    const newTok = generateToken(userA._id, 2);
    const newTokRes = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${newTok}` },
    });
    assert(newTokRes.status === 200, 'Test 11: Token matching current user tokenVersion accepted');
    passed++;
    console.log('✓ Test 11: Incrementing tokenVersion invalidates old JWT sessions');

    // Test 12: None algorithm JWT token rejected
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const nonePayload = Buffer.from(JSON.stringify({ sub: userA._id.toString() })).toString('base64url');
    const noneToken = `${noneHeader}.${nonePayload}.`;
    const noneRes = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${noneToken}` },
    });
    assert(noneRes.status === 401, 'Test 12: None algorithm token rejected with 401');
    passed++;
    console.log('✓ Test 12: None algorithm JWT token rejected with 401 Unauthorized');

    console.log('');

    // ================================================
    // REMEDIATION 5 & 6: AUTH & ERROR LEAKAGE SANITIZATION
    // ================================================
    console.log('--- REMEDIATION 5 & 6: AUTH & ERROR SANITIZATION ---');

    // Test 13: Invalid ObjectId CastError returns generic message 'Invalid resource identifier.'
    const castRes = await fetch(`${BASE_URL}/vns/invalid_id_format_123`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const castData = await castRes.json();
    assert(castRes.status === 400, 'Test 13: CastError returns 400 Bad Request');
    assert(castData.message === 'Invalid resource identifier.', 'Test 13: CastError returns generic error message without reflecting input');
    passed++;
    console.log('✓ Test 13: CastError returns safe generic message "Invalid resource identifier."');

    // Test 14: Failed login returns generic message 'Invalid email or password'
    const loginFailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'wrongpassword' }),
    });
    const loginFailData = await loginFailRes.json();
    assert(loginFailRes.status === 401 && loginFailData.message === 'Invalid email or password', 'Test 14: Generic login error');
    passed++;
    console.log('✓ Test 14: Failed login returns generic credentials error message');

    console.log('');

    // ================================================
    // STORAGE TRAVERSAL & CONTAINMENT AUDIT
    // ================================================
    console.log('--- STORAGE SECURITY & PATH TRAVERSAL CONTAINMENT ---');

    // Test 15: LocalStorageProvider rejects null bytes and directory traversal
    const localProvider = new LocalStorageProvider(path.resolve(__dirname, '../storage/audio'));
    assert.throws(
      () => localProvider._getSafePath('../../secret.txt'),
      /Access denied/,
      'Test 15: Directory traversal rejected'
    );
    assert.throws(
      () => localProvider._getSafePath('audio.mp3\0bar'),
      /Access denied/,
      'Test 15: Null byte injection rejected'
    );
    passed++;
    console.log('✓ Test 15: LocalStorageProvider path resolver rejects traversal and null bytes');

    console.log('');

    // ================================================
    // BOLA / IDOR CROSS-USER AUTHORIZATION AUDIT
    // ================================================
    console.log('--- CROSS-USER OBJECT AUTHORIZATION AUDIT ---');

    // Test 16: User B cannot access User A's private VoiceNote stream
    const privVn = await VoiceNote.create({
      ownerId: userA._id,
      title: 'Private A VN',
      audioUrl: 'audio/private_a.wav',
      duration: 5,
      visibility: 'private',
    });
    await fs.promises.writeFile(path.resolve(__dirname, '../storage/audio/private_a.wav'), createMinimalWavBuffer(1));

    const streamRes = await fetch(`${BASE_URL}/vns/${privVn._id}/stream`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(streamRes.status === 403, 'Test 16: Cross-user stream access rejected with 403');
    passed++;
    console.log('✓ Test 16: Private VoiceNote stream protected against cross-user BOLA/IDOR');

    // Test 17: User B cannot delete User A's VoiceNote
    const delRes = await fetch(`${BASE_URL}/vns/${privVn._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(delRes.status === 403, 'Test 17: Cross-user delete rejected with 403');
    passed++;
    console.log('✓ Test 17: VoiceNote deletion protected against cross-user BOLA/IDOR');

    console.log('');

    // ================================================
    // SUMMARY
    // ================================================
    console.log('========================================');
    console.log(`Phase 24 Security Remediation Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Phase 24 Test Error]', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    console.log('[Cleanup] Test server stopped and DB connection closed');
    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
