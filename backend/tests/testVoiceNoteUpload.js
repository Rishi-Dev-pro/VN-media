const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const config = require('../src/config/env');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5003;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

// Helper to generate minimal valid PCM WAV buffer with exact duration
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
function createUploadFormData({ title, description, visibility, buffer, filename = 'audio.wav', mimeType = 'audio/wav', extraFields = {} }) {
  const form = new FormData();
  if (title !== undefined) form.append('title', title);
  if (description !== undefined) form.append('description', description);
  if (visibility !== undefined) form.append('visibility', visibility);

  for (const [key, value] of Object.entries(extraFields)) {
    form.append(key, value);
  }

  if (buffer) {
    const fileBlob = new Blob([buffer], { type: mimeType });
    form.append('audio', fileBlob, filename);
  }

  return form;
}

const runTests = async () => {
  console.log('=== PHASE 3 VOICE NOTE UPLOAD & STORAGE TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    // Clean test database and sync indexes
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
    const userARes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user_a',
        email: 'usera@example.com',
        password: 'password123',
      }),
    });
    const userAData = await userARes.json();
    const userAId = userAData.data.user.id;

    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usera@example.com',
        password: 'password123',
      }),
    });
    const loginAData = await loginARes.json();
    const tokenA = loginAData.data.token;

    const userBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'user_b',
        email: 'userb@example.com',
        password: 'password123',
      }),
    });
    const userBData = await userBRes.json();
    const userBId = userBData.data.user.id;

    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'userb@example.com',
        password: 'password123',
      }),
    });
    const loginBData = await loginBRes.json();
    const tokenB = loginBData.data.token;

    console.log('Setup: Registered & Logged in User A (ID:', userAId, ') & User B (ID:', userBId, ')\n');

    // ----------------------------------------------------
    // AUTHENTICATION TESTS (Tests 1 - 2)
    // ----------------------------------------------------
    console.log('--- Testing Authentication ---');

    // Test 1: Unauthenticated upload is rejected
    const formUnauth = createUploadFormData({
      title: 'Unauthenticated Note',
      buffer: createMinimalWavBuffer(1),
    });
    const resTest1 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      body: formUnauth,
    });
    const dataTest1 = await resTest1.json();
    if (resTest1.status !== 401 || dataTest1.success !== false) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataTest1)}`);
    }
    console.log('✓ Test 1: Unauthenticated upload is rejected (401 Unauthorized)');

    // Test 2: Authenticated upload succeeds
    const formAuth = createUploadFormData({
      title: 'Authenticated Voice Note',
      buffer: createMinimalWavBuffer(1.5),
      visibility: 'private',
    });
    const resTest2 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formAuth,
    });
    const dataTest2 = await resTest2.json();
    if (resTest2.status !== 201 || !dataTest2.success || !dataTest2.data.voiceNote) {
      throw new Error(`Test 2 Failed: ${JSON.stringify(dataTest2)}`);
    }
    console.log('✓ Test 2: Authenticated upload succeeds (201 Created)');

    // ----------------------------------------------------
    // FILE VALIDATION TESTS (Tests 3 - 7)
    // ----------------------------------------------------
    console.log('\n--- Testing File Validation ---');

    // Test 3: Missing audio file is rejected
    const formNoFile = createUploadFormData({
      title: 'No Audio File Note',
    });
    const resTest3 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formNoFile,
    });
    const dataTest3 = await resTest3.json();
    if (resTest3.status !== 400 || dataTest3.message !== 'Audio file is required') {
      throw new Error(`Test 3 Failed: ${JSON.stringify(dataTest3)}`);
    }
    console.log('✓ Test 3: Missing audio file is rejected (400 Bad Request)');

    // Test 4: Unsupported file type is rejected
    const formBadType = createUploadFormData({
      title: 'Fake Audio File',
      buffer: Buffer.from('plain text file content'),
      filename: 'document.txt',
      mimeType: 'text/plain',
    });
    const resTest4 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formBadType,
    });
    const dataTest4 = await resTest4.json();
    if (resTest4.status !== 400 || dataTest4.success !== false) {
      throw new Error(`Test 4 Failed: ${JSON.stringify(dataTest4)}`);
    }
    console.log('✓ Test 4: Unsupported file type is rejected (400 Bad Request)');

    // Test 5: Oversized file is rejected (exceeds max bytes limit of 10MB)
    const formOversized = createUploadFormData({
      title: 'Oversized Audio',
      buffer: createMinimalWavBuffer(700), // ~11.2 MB buffer
    });
    const resTest5 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formOversized,
    });
    const dataTest5 = await resTest5.json();
    if (resTest5.status !== 413 || dataTest5.success !== false) {
      throw new Error(`Test 5 Failed: ${JSON.stringify(dataTest5)}`);
    }
    console.log('✓ Test 5: Oversized file is rejected (413 Payload Too Large)');

    // Test 6: Valid supported audio file succeeds
    const formValidWav = createUploadFormData({
      title: 'Valid WAV Audio',
      description: 'Test voice note description',
      buffer: createMinimalWavBuffer(2.0),
      filename: 'sample.wav',
      mimeType: 'audio/wav',
    });
    const resTest6 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formValidWav,
    });
    const dataTest6 = await resTest6.json();
    if (resTest6.status !== 201 || !dataTest6.data.voiceNote) {
      throw new Error(`Test 6 Failed: ${JSON.stringify(dataTest6)}`);
    }
    console.log('✓ Test 6: Valid supported audio file succeeds');

    // Test 7: Unsafe filename / path traversal attempt cannot escape storage directory
    const formPathTraversal = createUploadFormData({
      title: 'Path Traversal Attempt',
      buffer: createMinimalWavBuffer(1.0),
      filename: '../../../../etc/malicious.wav',
      mimeType: 'audio/wav',
    });
    const resTest7 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formPathTraversal,
    });
    const dataTest7 = await resTest7.json();
    if (resTest7.status !== 201 || dataTest7.data.voiceNote.audioUrl.includes('..')) {
      throw new Error(`Test 7 Failed: Path traversal exposed: ${JSON.stringify(dataTest7)}`);
    }
    const storedRef7 = dataTest7.data.voiceNote.audioUrl;
    const isStoredInsideDir = await storageService.fileExists(storedRef7);
    if (!isStoredInsideDir) {
      throw new Error('Test 7 Failed: File escaped storage directory');
    }
    console.log('✓ Test 7: Unsafe filename/path traversal attempt sanitized and safely stored inside storage directory');

    // ----------------------------------------------------
    // METADATA TESTS (Tests 8 - 12)
    // ----------------------------------------------------
    console.log('\n--- Testing Metadata Validation & Extraction ---');

    // Test 8: Missing title is rejected
    const formNoTitle = createUploadFormData({
      title: '',
      buffer: createMinimalWavBuffer(1),
    });
    const resTest8 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formNoTitle,
    });
    const dataTest8 = await resTest8.json();
    if (resTest8.status !== 400 || dataTest8.message !== 'Title is required') {
      throw new Error(`Test 8 Failed: ${JSON.stringify(dataTest8)}`);
    }
    console.log('✓ Test 8: Missing title is rejected (400 Bad Request)');

    // Test 9: Invalid visibility is rejected
    const formBadVis = createUploadFormData({
      title: 'Invalid Visibility Note',
      visibility: 'friends_only',
      buffer: createMinimalWavBuffer(1),
    });
    const resTest9 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formBadVis,
    });
    const dataTest9 = await resTest9.json();
    if (resTest9.status !== 400 || dataTest9.message !== 'Visibility must be either public or private') {
      throw new Error(`Test 9 Failed: ${JSON.stringify(dataTest9)}`);
    }
    console.log('✓ Test 9: Invalid visibility is rejected (400 Bad Request)');

    // Test 10: Description validation works
    const formLongDesc = createUploadFormData({
      title: 'Long Description Note',
      description: 'a'.repeat(1005),
      buffer: createMinimalWavBuffer(1),
    });
    const resTest10 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formLongDesc,
    });
    const dataTest10 = await resTest10.json();
    if (resTest10.status !== 400 || dataTest10.message !== 'Description cannot exceed 1000 characters') {
      throw new Error(`Test 10 Failed: ${JSON.stringify(dataTest10)}`);
    }
    console.log('✓ Test 10: Description length validation works');

    // Test 11: Stored duration comes from actual audio metadata
    const durationTarget = 3.5;
    const formDuration = createUploadFormData({
      title: 'Duration Test Note',
      buffer: createMinimalWavBuffer(durationTarget),
    });
    const resTest11 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formDuration,
    });
    const dataTest11 = await resTest11.json();
    if (resTest11.status !== 201 || dataTest11.data.voiceNote.duration !== 3.5) {
      throw new Error(`Test 11 Failed: Expected duration 3.5, got: ${dataTest11.data?.voiceNote?.duration}`);
    }
    console.log('✓ Test 11: Stored duration extracted from actual audio metadata (3.5s)');

    // Test 12: Stored audioUrl is a safe reference and does not expose absolute filesystem path
    const audioUrl12 = dataTest11.data.voiceNote.audioUrl;
    if (!audioUrl12.startsWith('audio/') || audioUrl12.includes('C:') || audioUrl12.includes('storage/audio')) {
      throw new Error(`Test 12 Failed: Absolute path exposed: ${audioUrl12}`);
    }
    console.log('✓ Test 12: Stored audioUrl is a safe storage reference (e.g. "audio/<uuid>.wav")');

    // ----------------------------------------------------
    // OWNERSHIP & ACCESS CONTROL TESTS (Tests 13 - 18)
    // ----------------------------------------------------
    console.log('\n--- Testing Ownership & Access Control ---');

    // Test 13: Uploaded VoiceNote ownerId comes from authenticated user JWT
    if (dataTest11.data.voiceNote.ownerId !== userAId) {
      throw new Error(`Test 13 Failed: Expected ownerId ${userAId}, got ${dataTest11.data.voiceNote.ownerId}`);
    }
    console.log('✓ Test 13: Uploaded VoiceNote ownerId comes from authenticated JWT user');

    // Test 14: Client cannot assign another user's ID as owner
    const formSpoofOwner = createUploadFormData({
      title: 'Spoof Owner Note',
      buffer: createMinimalWavBuffer(1),
      extraFields: { ownerId: userBId }, // Attempting to spoof ownerId
    });
    const resTest14 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formSpoofOwner,
    });
    const dataTest14 = await resTest14.json();
    if (resTest14.status !== 201 || dataTest14.data.voiceNote.ownerId !== userAId) {
      throw new Error(`Test 14 Failed: Owner spoofing succeeded: ${JSON.stringify(dataTest14)}`);
    }
    console.log('✓ Test 14: Client cannot assign another user ID as owner');

    const vnA_id = dataTest14.data.voiceNote.id;

    // Test 15: User can retrieve their own VNs through GET /api/vns/me
    const resTest15 = await fetch(`${BASE_URL}/vns/me?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataTest15 = await resTest15.json();
    if (resTest15.status !== 200 || !dataTest15.data.voiceNotes || dataTest15.data.pagination.total < 1) {
      throw new Error(`Test 15 Failed: ${JSON.stringify(dataTest15)}`);
    }
    console.log('✓ Test 15: User can retrieve their own VNs through GET /api/vns/me');

    // Test 16: User B cannot retrieve User A's VN through single-VN endpoint
    const resTest16 = await fetch(`${BASE_URL}/vns/${vnA_id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataTest16 = await resTest16.json();
    if (resTest16.status !== 403 || dataTest16.success !== false) {
      throw new Error(`Test 16 Failed: Non-owner retrieved VN: ${JSON.stringify(dataTest16)}`);
    }
    console.log('✓ Test 16: User B cannot retrieve User A VN through single-VN endpoint (403 Forbidden)');

    // Test 17: User B cannot delete User A's VN
    const resTest17 = await fetch(`${BASE_URL}/vns/${vnA_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const dataTest17 = await resTest17.json();
    if (resTest17.status !== 403 || dataTest17.success !== false) {
      throw new Error(`Test 17 Failed: Non-owner deleted VN: ${JSON.stringify(dataTest17)}`);
    }
    console.log('✓ Test 17: User B cannot delete User A VN (403 Forbidden)');

    // Test 18: Owner (User A) can delete their own VN
    const resTest18 = await fetch(`${BASE_URL}/vns/${vnA_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataTest18 = await resTest18.json();
    if (resTest18.status !== 200 || !dataTest18.success) {
      throw new Error(`Test 18 Failed: Owner deletion failed: ${JSON.stringify(dataTest18)}`);
    }
    console.log('✓ Test 18: Owner can delete their own VN (200 OK)');

    // ----------------------------------------------------
    // STORAGE LIFECYCLE & CONSISTENCY TESTS (Tests 19 - 23)
    // ----------------------------------------------------
    console.log('\n--- Testing Storage Lifecycle & DB Consistency ---');

    // Test 19: Successful upload creates both audio file and MongoDB document
    const formLifecycle = createUploadFormData({
      title: 'Lifecycle Verification Note',
      buffer: createMinimalWavBuffer(1.2),
    });
    const resTest19 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formLifecycle,
    });
    const dataTest19 = await resTest19.json();
    const vn19 = dataTest19.data.voiceNote;
    const fileExists19 = await storageService.fileExists(vn19.audioUrl);
    const dbDoc19 = await VoiceNote.findById(vn19.id);
    if (!fileExists19 || !dbDoc19) {
      throw new Error('Test 19 Failed: Audio file or DB document missing');
    }
    console.log('✓ Test 19: Successful upload creates both audio file and MongoDB document');

    // Test 20: Failed database creation cleans up the stored file
    const voiceNoteService = require('../src/services/voiceNote.service');
    const originalCreate = VoiceNote.create;
    let attemptedStorageRef = null;
    VoiceNote.create = async function (...args) {
      attemptedStorageRef = args[0].audioUrl;
      throw new Error('Simulated Database Failure');
    };

    const formFailDb = createUploadFormData({
      title: 'DB Failure Test Note',
      buffer: createMinimalWavBuffer(1),
    });

    let dbFailCaught = false;
    try {
      await voiceNoteService.createVoiceNote({
        user: { _id: userAId },
        file: {
          buffer: createMinimalWavBuffer(1),
          originalname: 'sample.wav',
          mimetype: 'audio/wav',
        },
        title: 'DB Fail Note',
      });
    } catch (err) {
      if (err.message === 'Simulated Database Failure') {
        dbFailCaught = true;
      }
    } finally {
      VoiceNote.create = originalCreate; // Restore original function
    }

    if (!dbFailCaught || !attemptedStorageRef) {
      throw new Error('Test 20 Failed: Database failure was not triggered properly');
    }
    const fileExists20 = await storageService.fileExists(attemptedStorageRef);
    if (fileExists20) {
      throw new Error('Test 20 Failed: Orphaned file was not cleaned up after DB failure');
    }
    console.log('✓ Test 20: Failed database creation cleans up the stored file (no orphaned files)');

    // Test 21: Deleting a VN removes its stored audio file
    const audioUrl19 = vn19.audioUrl;
    await fetch(`${BASE_URL}/vns/${vn19.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const fileExists21 = await storageService.fileExists(audioUrl19);
    if (fileExists21) {
      throw new Error('Test 21 Failed: Audio file still exists on disk after VN deletion');
    }
    console.log('✓ Test 21: Deleting a VN removes its stored audio file from disk');

    // Test 22: Deleting a VN removes its database record
    const dbDoc22 = await VoiceNote.findById(vn19.id);
    if (dbDoc22) {
      throw new Error('Test 22 Failed: MongoDB document still exists after deletion');
    }
    console.log('✓ Test 22: Deleting a VN removes its database record');

    // Test 23: Deleting a VN whose file is already missing still handles database cleanup correctly
    const formMissingFile = createUploadFormData({
      title: 'Missing File Deletion Note',
      buffer: createMinimalWavBuffer(1),
    });
    const resTest23Upload = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formMissingFile,
    });
    const dataTest23Upload = await resTest23Upload.json();
    const vn23 = dataTest23Upload.data.voiceNote;

    // Manually delete stored file from disk before API call
    await storageService.deleteFile(vn23.audioUrl);

    // Call DELETE API
    const resTest23Del = await fetch(`${BASE_URL}/vns/${vn23.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const dataTest23Del = await resTest23Del.json();
    const dbDoc23 = await VoiceNote.findById(vn23.id);

    if (resTest23Del.status !== 200 || !dataTest23Del.success || dbDoc23) {
      throw new Error(`Test 23 Failed: DB cleanup failed when stored file was missing: ${JSON.stringify(dataTest23Del)}`);
    }
    console.log('✓ Test 23: Deleting a VN whose file is already missing completes DB cleanup gracefully');

    console.log('\n=== ALL 23 PHASE 3 VOICE NOTE UPLOAD & STORAGE TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ VOICE NOTE UPLOAD TEST FAILED:', error);
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
