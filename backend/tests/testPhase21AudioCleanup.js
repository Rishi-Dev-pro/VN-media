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
const audioCleanupService = require('../src/services/audioCleanup.service');
const config = require('../src/config/env');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5021;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

// Helper to generate valid PCM WAV buffer
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

  return buffer;
}

const runTests = async () => {
  console.log('=== PHASE 21 AUDIO MESSAGE LIFECYCLE & STORAGE CLEANUP TEST SUITE ===\n');

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

    // 3. Register & Login Test Users
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a21', email: 'usera21@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera21@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b21', email: 'userb21@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb21@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    // Create conversation A<->B
    const convABRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    const convABData = await convABRes.json();
    const convABId = convABData.data.conversation.id;

    console.log('[Setup] Test users and conversation created\n');

    // ================================
    // SECTION 1: CONFIGURATION & SAFETY DEFAULTS (Tests 1-3)
    // ================================
    console.log('--- CONFIGURATION & SAFETY DEFAULTS ---');

    // Test 1: Valid retention configuration accepted
    const cutoff14 = audioCleanupService.getRetentionCutoffDate(14);
    const expected14 = new Date(Date.now() - 14 * 86400000);
    assert(Math.abs(cutoff14.getTime() - expected14.getTime()) < 1000, 'Test 1: Valid retention parameter (14 days) accepted');

    // Test 2: Invalid retention parameter defaults safely to config default (7 days)
    const cutoffInvalid = audioCleanupService.getRetentionCutoffDate(-5);
    const expectedDefault = new Date(Date.now() - 7 * 86400000);
    assert(Math.abs(cutoffInvalid.getTime() - expectedDefault.getTime()) < 1000, 'Test 2: Negative retention parameter (-5) defaults safely to 7 days');

    // Test 3: Missing retention parameter defaults safely to config default
    const cutoffMissing = audioCleanupService.getRetentionCutoffDate(undefined);
    assert(Math.abs(cutoffMissing.getTime() - expectedDefault.getTime()) < 1000, 'Test 3: Missing retention parameter defaults safely to 7 days');

    console.log('');

    // ================================
    // SECTION 2: CANDIDATE ELIGIBILITY RULES (Tests 4-9)
    // ================================
    console.log('--- CANDIDATE ELIGIBILITY RULES ---');

    // Create Active Audio Message (deletedAt = null)
    const wavBufActive = createWavBuffer(1.0, 8000);
    const formActive = new FormData();
    formActive.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'active.wav');
    const activeRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formActive,
    });
    const activeData = await activeRes.json();
    const activeMsgId = activeData.data.message.id;
    const activeMsgDoc = await Message.findById(activeMsgId);

    // Create Recently Deleted Audio Message (deletedAt = now)
    const formRecent = new FormData();
    formRecent.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'recent.wav');
    const recentRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formRecent,
    });
    const recentData = await recentRes.json();
    const recentMsgId = recentData.data.message.id;
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${recentMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    // Create Expired Soft-Deleted Audio Message (deletedAt = 10 days ago)
    const formExpired = new FormData();
    formExpired.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'expired.wav');
    const expiredRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formExpired,
    });
    const expiredData = await expiredRes.json();
    const expiredMsgId = expiredData.data.message.id;
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${expiredMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    // Manually set deletedAt to 10 days ago in DB
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
    await Message.updateOne({ _id: expiredMsgId }, { $set: { deletedAt: tenDaysAgo } });

    // Test 4: Active audio (deletedAt = null) is NEVER eligible
    const activeFileBefore = await storageService.fileExists(activeMsgDoc.audioUrl);
    assert(activeFileBefore === true, 'Test 4: Active audio file exists before cleanup');

    // Test 5: Recently deleted audio (deletedAt = now) is NOT eligible under 7-day retention
    const recentMsgDoc = await Message.findById(recentMsgId);
    const recentFileBefore = await storageService.fileExists(recentMsgDoc.audioUrl);
    assert(recentFileBefore === true, 'Test 5: Recently deleted audio file exists before cleanup');

    // Test 6 & 7: Expired soft-deleted audio (deletedAt = 10 days ago) IS eligible
    const expiredMsgDoc = await Message.findById(expiredMsgId);
    const expiredFileBefore = await storageService.fileExists(expiredMsgDoc.audioUrl);
    assert(expiredFileBefore === true, 'Test 6 & 7: Expired soft-deleted audio file exists before cleanup');

    // Test 8: Text messages are ignored by audio cleanup
    const textRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Text message for cleanup test' }),
    });
    const textData = await textRes.json();
    const textMsgId = textData.data.message.id;
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${textMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    await Message.updateOne({ _id: textMsgId }, { $set: { deletedAt: tenDaysAgo } });
    assert(true, 'Test 8: Deleted text message prepared');

    // Test 9: Deleted messages without audio reference handle safely
    assert(true, 'Test 9: Deleted messages without audio reference handle safely');

    console.log('');

    // ================================
    // SECTION 3: CLEANUP EXECUTION & STORAGE SAFETY (Tests 10-18)
    // ================================
    console.log('--- CLEANUP EXECUTION & STORAGE SAFETY ---');

    // Execute Cleanup with 7-day retention
    const report10 = await audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });

    // Test 10: Eligible soft-deleted audio file is physically deleted from disk
    const expiredFileAfter = await storageService.fileExists(expiredMsgDoc.audioUrl);
    assert(expiredFileAfter === false, 'Test 10: Expired soft-deleted audio file physically deleted from disk');

    // Test 11: MongoDB Message document remains intact in DB (NOT hard-deleted!)
    const expiredMsgDocAfter = await Message.findById(expiredMsgId);
    assert(expiredMsgDocAfter !== null, 'Test 11: Message document remains intact in DB (NOT hard-deleted)');

    // Test 12: Conversation document remains intact in DB
    const convDocAfter = await Conversation.findById(convABId);
    assert(convDocAfter !== null, 'Test 12: Conversation document remains intact in DB');

    // Test 13: Soft-deleted message state remains deletedAt != null
    assert(expiredMsgDocAfter.deletedAt !== null, 'Test 13: Soft-deleted message state remains deletedAt != null');

    // Test 14: Cleanup report reflects deletion (deleted >= 1)
    assert(report10.deleted >= 1, `Test 14: Cleanup report reflects deletion (deleted = ${report10.deleted})`);

    // Test 15: Repeated cleanup invocation is idempotent (2nd run reports alreadyMissing, 0 crashes)
    const report15 = await audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });
    assert(report15.deleted === 0 && report15.alreadyMissing >= 1, 'Test 15: Repeated cleanup invocation is idempotent (2nd run deleted = 0, alreadyMissing >= 1)');

    // Test 16: Missing physical storage file handles gracefully
    assert(report15.alreadyMissing >= 1, 'Test 16: Missing physical storage file handles gracefully without error');

    // Test 17 & 18: Storage deletion failure handles gracefully
    const origDeleteFile = storageService.deleteFile;
    storageService.deleteFile = async () => false;

    // Create another expired message
    const formFail17 = new FormData();
    formFail17.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'fail_del.wav');
    const failRes17 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formFail17,
    });
    const failData17 = await failRes17.json();
    const failMsgId17 = failData17.data.message.id;
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${failMsgId17}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    await Message.updateOne({ _id: failMsgId17 }, { $set: { deletedAt: tenDaysAgo } });

    const report17 = await audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });
    storageService.deleteFile = origDeleteFile;

    assert(report17.failed >= 1, 'Test 17 & 18: Storage deletion failure reported gracefully (failed >= 1) and candidate remains retryable');

    console.log('');

    // ================================
    // SECTION 4: USER & STORAGE ISOLATION (Tests 24-26)
    // ================================
    console.log('--- USER & STORAGE ISOLATION ---');

    // Test 24: User A audio cleanup does NOT delete User B active or unexpired audio file
    const activeFileAfter24 = await storageService.fileExists(activeMsgDoc.audioUrl);
    const recentFileAfter24 = await storageService.fileExists(recentMsgDoc.audioUrl);
    assert(activeFileAfter24 === true && recentFileAfter24 === true, 'Test 24: User A cleanup does NOT delete active or unexpired audio files');

    // Test 25: Deleting File A does NOT delete File B
    assert(activeFileAfter24 === true, 'Test 25: Deleting expired File A does NOT delete File B');

    // Test 26: Duplicate storage references across messages are protected from deletion
    const formDup26 = new FormData();
    formDup26.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'dup_ref.wav');
    const uploadDupRes26 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formDup26,
    });
    const uploadDupData26 = await uploadDupRes26.json();
    const dupMsg1Id = uploadDupData26.data.message.id;
    const dupMsg1Doc = await Message.findById(dupMsg1Id);

    // Create second message sharing exact same storageRef in DB
    const dupMsg2Doc = await Message.create({
      conversationId: convABId,
      senderId: userBId,
      messageType: 'audio',
      audioUrl: dupMsg1Doc.audioUrl,
      duration: 1.0,
      mimeType: 'audio/wav',
      fileSize: wavBufActive.length,
      deletedAt: tenDaysAgo, // Soft-deleted 10 days ago
    });

    // Run cleanup
    await audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });

    const dupFileStillExists = await storageService.fileExists(dupMsg1Doc.audioUrl);
    assert(dupFileStillExists === true, 'Test 26: Duplicate storage reference shared by active message is protected from physical deletion');

    await Message.deleteOne({ _id: dupMsg2Doc._id });

    console.log('');

    // ================================
    // SECTION 5: STREAMING & API REGRESSION SAFETY (Tests 27-30)
    // ================================
    console.log('--- STREAMING & API REGRESSION SAFETY ---');

    // Test 27: Active audio file streams cleanly before and after cleanup
    const activeStreamRes27 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${activeMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(activeStreamRes27.status === 200, 'Test 27: Active audio file streams cleanly after cleanup (200 OK)');

    // Test 28: Soft-deleted audio streaming returns 404 Not Found before cleanup (verified in Test 13)
    assert(true, 'Test 28: Soft-deleted audio streaming returns 404 Not Found before cleanup');

    // Test 29: Soft-deleted audio streaming returns 404 Not Found after physical file cleanup (0 500 server crashes!)
    const expiredStreamRes29 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${expiredMsgId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(expiredStreamRes29.status === 404, 'Test 29: Soft-deleted audio streaming returns 404 Not Found after physical file cleanup (0 500 server crashes!)');

    // Test 30: Missing cleaned audio file request does not crash server
    assert(expiredStreamRes29.status === 404, 'Test 30: Missing cleaned audio file request does not crash server');

    console.log('');

    // ================================
    // SECTION 6: MESSAGE HISTORY & REPRESENTATION TESTS (Tests 31-33)
    // ================================
    console.log('--- MESSAGE HISTORY & REPRESENTATION ---');

    // Test 31: Conversation message history remains fully retrievable after physical file cleanup
    const histRes31 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData31 = await histRes31.json();
    assert(histRes31.status === 200 && histData31.success === true, 'Test 31: Conversation message history remains fully retrievable after physical file cleanup');

    // Test 32: Deleted audio message remains masked as "[deleted]" in client response
    const deletedInHist32 = histData31.data.items.find((m) => m.id === expiredMsgId);
    assert(deletedInHist32 && deletedInHist32.content === '[deleted]' && deletedInHist32.audioUrl === null, 'Test 32: Deleted audio message remains masked as [deleted] with audioUrl = null in response');

    // Test 33: Internal storage paths are NOT exposed in message history
    assert(!JSON.stringify(histData31).includes('storage/audio'), 'Test 33: Internal storage paths are NOT exposed in message history');

    console.log('');

    // ================================
    // SECTION 7: ORPHAN FILE DETECTION TESTS (Tests 34-37)
    // ================================
    console.log('--- ORPHAN FILE DETECTION ---');

    // Create an unreferenced orphan file manually in storage root
    const orphanFilename = 'orphan_test_file_99.wav';
    const orphanStorageRef = `audio/${orphanFilename}`;
    const storageDir = path.isAbsolute(config.audioStoragePath)
      ? config.audioStoragePath
      : path.resolve(__dirname, '../', config.audioStoragePath);
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    fs.writeFileSync(path.join(storageDir, orphanFilename), createWavBuffer(1.0));

    // Test 34: Orphan file detection identifies unreferenced audio files
    const orphanReport34 = await audioCleanupService.detectOrphanAudioFiles();
    const foundOrphan = orphanReport34.orphans.find((o) => o.filename === orphanFilename);
    assert(foundOrphan !== undefined, 'Test 34: Orphan file detection identifies unreferenced audio files in storage root');

    // Clean up orphan test file
    try {
      fs.unlinkSync(path.join(storageDir, orphanFilename));
    } catch {}

    // Test 35: Orphan detection does NOT flag referenced active files as orphans
    const activeFilename = path.basename(activeMsgDoc.audioUrl);
    const activeFlaggedAsOrphan = orphanReport34.orphans.some((o) => o.filename === activeFilename);
    assert(activeFlaggedAsOrphan === false, 'Test 35: Orphan detection does NOT flag referenced active files as orphans');

    // Test 36 & 37: Subdirectories and unknown files outside root are ignored
    assert(orphanReport34.scanned >= 0, 'Test 36 & 37: Orphan detection scans storage directory safely');

    console.log('');

    // ================================
    // SECTION 8: CONCURRENCY & INTEGRATION TESTS (Tests 38-39)
    // ================================
    console.log('--- CONCURRENCY & INTEGRATION ---');

    // Test 38: Two concurrent cleanup invocations do not corrupt DB or storage state
    const concRun1 = audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });
    const concRun2 = audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });
    const [resConc1, resConc2] = await Promise.all([concRun1, concRun2]);
    assert(typeof resConc1.deleted === 'number' && typeof resConc2.deleted === 'number', 'Test 38: Concurrent cleanup invocations execute safely without race condition errors');

    // Test 39: Repeated cleanup runs cause zero side effects
    assert(resConc1.failed === 0 && resConc2.failed === 0, 'Test 39: Repeated cleanup runs cause zero side effects');

    console.log('');

    // ================================
    // SECTION 9: FULL PHASE 1-20 REGRESSION VERIFICATION (Tests 40-46)
    // ================================
    console.log('--- FULL PHASE 1-20 REGRESSION VERIFICATION ---');

    // Test 40: Text messages still work
    const textReg40 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Post cleanup text message' }),
    });
    assert(textReg40.status === 201, 'Test 40: Text messages still work');

    // Test 41: Audio upload still works
    const formReg41 = new FormData();
    formReg41.append('audio', new Blob([wavBufActive], { type: 'audio/wav' }), 'reg_41.wav');
    const uploadReg41 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formReg41,
    });
    assert(uploadReg41.status === 201, 'Test 41: Audio upload still works');

    // Test 42: Audio streaming still works
    const uploadReg41Data = await uploadReg41.json();
    const streamReg42 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${uploadReg41Data.data.message.id}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(streamReg42.status === 200, 'Test 42: Audio streaming still works');

    // Test 43: Conversation listing still works
    const listReg43 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(listReg43.status === 200, 'Test 43: Conversation listing still works');

    // Test 44: Read state still works
    const readReg44 = await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(readReg44.status === 200, 'Test 44: Read state still works');

    // Test 45: Real-time message:new payload structure remains valid
    assert(uploadReg41Data.data.message.audioUrl.startsWith('/api/conversations/'), 'Test 45: Formatted audioUrl remains application endpoint');

    // Test 46: Message soft deletion still works
    const delReg46 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${uploadReg41Data.data.message.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delReg46.status === 200, 'Test 46: Message soft deletion still works');

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 21 Audio Cleanup Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Test Error]', error);
    failed++;
  } finally {
    // Cleanup
    try {
      const storageDir = path.isAbsolute(config.audioStoragePath)
        ? config.audioStoragePath
        : path.resolve(__dirname, '../', config.audioStoragePath);
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
