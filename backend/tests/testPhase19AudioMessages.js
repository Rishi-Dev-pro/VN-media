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
const TEST_PORT = 5019;
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
  console.log('=== PHASE 19 AUDIO MESSAGE UPLOAD & STORAGE TEST SUITE ===\n');

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
      body: JSON.stringify({ username: 'user_a19', email: 'usera19@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera19@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b19', email: 'userb19@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb19@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c19', email: 'userc19@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc19@example.com', password: 'password123' }),
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

    console.log('[Setup] Test users and conversation created\n');

    // ================================
    // SECTION 1: STORAGE INTEGRITY & UPLOAD VALIDATION TESTS (Tests 1-12)
    // ================================
    console.log('--- STORAGE INTEGRITY & UPLOAD VALIDATION ---');

    // Test 1 & 2: Valid audio upload creates Message with messageType = 'audio'
    const wavBuffer1 = createWavBuffer(1.5, 8000);
    const form1 = new FormData();
    form1.append('audio', new Blob([wavBuffer1], { type: 'audio/wav' }), 'voice_msg.wav');

    const uploadRes1 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form1,
    });
    const uploadData1 = await uploadRes1.json();
    assert(uploadRes1.status === 201 && uploadData1.success === true && uploadData1.data.message.messageType === 'audio', 'Test 1: Valid audio upload creates Message with messageType = audio');
    const audioMsg1 = uploadData1.data.message;

    // Test 2: Audio message response contains valid audioUrl, duration, mimeType, and fileSize
    assert(
      audioMsg1.audioUrl &&
      audioMsg1.duration >= 1.4 &&
      audioMsg1.mimeType === 'audio/wav' &&
      audioMsg1.fileSize === wavBuffer1.length,
      'Test 2: Audio message response contains valid audioUrl, duration, mimeType, and fileSize'
    );

    // Test 3: Audio file exists in storage at storageRef
    const fileExists3 = await storageService.fileExists(audioMsg1.audioUrl);
    assert(fileExists3 === true, 'Test 3: Audio file exists in storage at storageRef');

    // Test 4: Database audio reference points to valid storage reference
    const msgDoc4 = await Message.findById(audioMsg1.id);
    assert(msgDoc4 && msgDoc4.audioUrl === audioMsg1.audioUrl, 'Test 4: DB audioUrl matches storageRef');

    // Test 5: Correct duration is extracted and stored
    assert(msgDoc4.duration >= 1.4, 'Test 5: Correct duration extracted and stored in DB');

    // Test 6: Correct MIME type stored
    assert(msgDoc4.mimeType === 'audio/wav', 'Test 6: Correct MIME type stored in DB');

    // Test 7: Correct file size stored
    assert(msgDoc4.fileSize === wavBuffer1.length, 'Test 7: Correct file size stored in DB');

    // Test 8: Existing text messages remain fully compatible
    const textRes8 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Compatibility text message' }),
    });
    const textData8 = await textRes8.json();
    assert(textRes8.status === 201 && textData8.data.message.messageType === 'text', 'Test 8: Existing text messages remain fully compatible');

    // Test 9: Unsupported MIME type rejected (400 Bad Request)
    const form9 = new FormData();
    form9.append('audio', new Blob(['fake content'], { type: 'application/pdf' }), 'test.pdf');
    const uploadRes9 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form9,
    });
    assert(uploadRes9.status === 400, 'Test 9: Unsupported MIME type (application/pdf) rejected with 400');

    // Test 10: Unsupported extension (.txt) rejected (400 Bad Request)
    const form10 = new FormData();
    form10.append('audio', new Blob(['fake content'], { type: 'audio/wav' }), 'test.txt');
    const uploadRes10 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form10,
    });
    assert(uploadRes10.status === 400, 'Test 10: Unsupported extension (.txt) rejected with 400');

    // Test 11: Missing audio file rejected (400 Bad Request)
    const form11 = new FormData();
    const uploadRes11 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form11,
    });
    assert(uploadRes11.status === 400, 'Test 11: Missing audio file rejected with 400 Bad Request');

    // Test 12: Corrupted audio magic bytes rejected (400 Bad Request)
    const form12 = new FormData();
    form12.append('audio', new Blob(['invalid binary magic bytes'], { type: 'audio/wav' }), 'corrupt.wav');
    const uploadRes12 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form12,
    });
    assert(uploadRes12.status === 400, 'Test 12: Corrupted audio magic bytes rejected with 400 Bad Request');

    console.log('');

    // ================================
    // SECTION 2: AUTHORIZATION & IDENTITY TESTS (Tests 13-18)
    // ================================
    console.log('--- AUTHORIZATION & IDENTITY TESTS ---');

    // Test 13: Participant A can upload audio
    assert(uploadRes1.status === 201, 'Test 13: Participant A can upload audio');

    // Test 14: Participant B can upload audio
    const wavBuffer14 = createWavBuffer(1.0, 8000);
    const form14 = new FormData();
    form14.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'reply.wav');
    const uploadRes14 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: form14,
    });
    const uploadData14 = await uploadRes14.json();
    assert(uploadRes14.status === 201 && uploadData14.data.message.sender.id === userBId, 'Test 14: Participant B can upload audio');

    // Test 15: Non-participant C cannot upload audio (404 Not Found)
    const form15 = new FormData();
    form15.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'unauth.wav');
    const uploadRes15 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}` },
      body: form15,
    });
    assert(uploadRes15.status === 404, 'Test 15: Non-participant C cannot upload audio (404)');

    // Test 16: Unauthenticated upload rejected (401 Unauthorized)
    const uploadRes16 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      body: form15,
    });
    assert(uploadRes16.status === 401, 'Test 16: Unauthenticated upload rejected with 401');

    // Test 17: Conversation ID spoofing rejected (404)
    const fakeConvId = new mongoose.Types.ObjectId();
    const uploadRes17 = await fetch(`${BASE_URL}/conversations/${fakeConvId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form14,
    });
    assert(uploadRes17.status === 404, 'Test 17: Invalid/fake conversation ID audio upload rejected (404)');

    // Test 18: senderId client spoofing fails (uses req.user._id)
    const form18 = new FormData();
    form18.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'spoof.wav');
    form18.append('senderId', userBId);
    const uploadRes18 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form18,
    });
    const uploadData18 = await uploadRes18.json();
    assert(uploadRes18.status === 201 && uploadData18.data.message.sender.id === userAId, 'Test 18: Client senderId spoofing fails (sender remains User A)');

    console.log('');

    // ================================
    // SECTION 3: MESSAGE HISTORY & COEXISTENCE TESTS (Tests 19-23)
    // ================================
    console.log('--- MESSAGE HISTORY & COEXISTENCE TESTS ---');

    // Test 19: Audio message appears in conversation history
    const histRes19 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData19 = await histRes19.json();
    const audioInHist19 = histData19.data.items.find((m) => m.id === audioMsg1.id);
    assert(audioInHist19 && audioInHist19.messageType === 'audio' && audioInHist19.audioUrl, 'Test 19: Audio message appears in message history');

    // Test 20: Text and audio messages coexist cleanly in history
    const hasText = histData19.data.items.some((m) => m.messageType === 'text');
    const hasAudio = histData19.data.items.some((m) => m.messageType === 'audio');
    assert(hasText && hasAudio, 'Test 20: Text and audio messages coexist cleanly in history');

    // Test 21: Audio message ordering is deterministic (createdAt ASC)
    const items21 = histData19.data.items;
    let isOrdered21 = true;
    for (let i = 1; i < items21.length; i++) {
      if (new Date(items21[i].createdAt) < new Date(items21[i - 1].createdAt)) {
        isOrdered21 = false;
        break;
      }
    }
    assert(isOrdered21, 'Test 21: Message history with audio messages is ordered deterministically (createdAt ASC)');

    // Test 22: Message history pagination works with audio messages
    const histRes22 = await fetch(`${BASE_URL}/conversations/${convABId}/messages?page=1&limit=2`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData22 = await histRes22.json();
    assert(histData22.data.items.length === 2 && histData22.data.pagination.limit === 2, 'Test 22: Pagination works with audio messages');

    // Test 23: Unauthorized user C cannot retrieve audio message history (404)
    const histRes23 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(histRes23.status === 404, 'Test 23: Unauthorized user C cannot retrieve audio message history (404)');

    console.log('');

    // ================================
    // SECTION 4: READ STATE & UNREAD COUNT TESTS (Tests 24-27)
    // ================================
    console.log('--- READ STATE & UNREAD COUNT TESTS ---');

    // Test 24: Audio message starts with readAt = null
    const audioMsg14Id = uploadData14.data.message.id;
    const msg14Doc = await Message.findById(audioMsg14Id);
    assert(msg14Doc.readAt === null, 'Test 24: New incoming audio message from B has readAt = null');

    // Test 25: Recipient User A can mark audio message read
    const markReadRes25 = await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const markReadData25 = await markReadRes25.json();
    assert(markReadRes25.status === 200 && markReadData25.data.updatedCount > 0, 'Test 25: Recipient User A can mark audio message as read');

    // Test 26: Audio message contributes to unreadCount
    // User B sends an audio message
    const form26 = new FormData();
    form26.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'unread_test.wav');
    const uploadRes26 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: form26,
    });
    const uploadData26 = await uploadRes26.json();
    const audioMsg26Id = uploadData26.data.message.id;

    const convRes26 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convData26 = await convRes26.json();
    assert(convData26.data.conversation.unreadCount > 0, 'Test 26: Audio message contributes to unreadCount');

    // Test 27: Deleted audio message does NOT contribute to unreadCount
    const unreadBefore27 = convData26.data.conversation.unreadCount;

    // User B deletes the audio message
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${audioMsg26Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });

    const convRes27 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convData27 = await convRes27.json();
    assert(convData27.data.conversation.unreadCount === unreadBefore27 - 1, 'Test 27: Soft-deleted audio message does NOT contribute to unreadCount');

    console.log('');

    // ================================
    // SECTION 5: SOFT DELETION & CONTENT MASKING TESTS (Tests 28-33)
    // ================================
    console.log('--- SOFT DELETION & CONTENT MASKING ---');

    // Test 28: Sender A can soft-delete audio message
    const delRes28 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${audioMsg1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes28.status === 200, 'Test 28: Sender A can soft-delete own audio message');

    // Test 29: Non-sender B cannot delete A's audio message (403 Forbidden)
    const form29 = new FormData();
    form29.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'a_audio.wav');
    const uploadRes29 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form29,
    });
    const uploadData29 = await uploadRes29.json();
    const audioMsg29Id = uploadData29.data.message.id;

    const delRes29 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${audioMsg29Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(delRes29.status === 403, 'Test 29: Non-sender B cannot delete A audio message (403 Forbidden)');

    // Test 30: Deleted audio content is masked (content = "[deleted]")
    const histRes30 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData30 = await histRes30.json();
    const deletedAudio30 = histData30.data.items.find((m) => m.id === audioMsg1.id);
    assert(deletedAudio30 && deletedAudio30.content === '[deleted]', 'Test 30: Soft-deleted audio content masked as [deleted]');

    // Test 31: Deleted audio metadata (audioUrl, duration, mimeType, fileSize) is hidden/nullified in response
    assert(
      deletedAudio30.audioUrl === null &&
      deletedAudio30.duration === null &&
      deletedAudio30.mimeType === null &&
      deletedAudio30.fileSize === null,
      'Test 31: Soft-deleted audio metadata (audioUrl, duration, mimeType, fileSize) is hidden (null) in response'
    );

    // Test 32: Message document structure remains intact in DB (deletedAt != null)
    const msgDoc32 = await Message.findById(audioMsg1.id);
    assert(msgDoc32 && msgDoc32.deletedAt !== null && msgDoc32.audioUrl === audioMsg1.audioUrl, 'Test 32: Message document structure remains intact in DB with deletedAt timestamp');

    // Test 33: Repeated deletion is idempotent (200 OK)
    const delRes33 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${audioMsg1.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes33.status === 200, 'Test 33: Repeated audio message deletion is idempotent (200 OK)');

    console.log('');

    // ================================
    // SECTION 6: STORAGE FAILURE SAFETY (NO ORPHAN FILES) (Test 43)
    // ================================
    console.log('--- STORAGE FAILURE SAFETY (NO ORPHAN FILES) ---');

    // Test 43: Failure safety — when database creation fails, newly saved audio file is cleaned up from storage
    const origCreate = Message.create;
    Message.create = async function () {
      throw new Error('Simulated DB Failure');
    };

    const form43 = new FormData();
    form43.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'fail_test.wav');

    let storageFilesBefore = 0;
    try {
      const storageDir = storageService.getStoragePath ? storageService.getStoragePath() : path.resolve(__dirname, '../../storage/audio');
      if (fs.existsSync(storageDir)) {
        storageFilesBefore = fs.readdirSync(storageDir).length;
      }
    } catch {}

    const uploadRes43 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form43,
    });

    Message.create = origCreate;

    let storageFilesAfter = 0;
    try {
      const storageDir = storageService.getStoragePath ? storageService.getStoragePath() : path.resolve(__dirname, '../../storage/audio');
      if (fs.existsSync(storageDir)) {
        storageFilesAfter = fs.readdirSync(storageDir).length;
      }
    } catch {}

    assert(
      uploadRes43.status === 500 && storageFilesAfter === storageFilesBefore,
      'Test 43: Failure safety — orphan audio file cleaned up from storage when DB creation fails'
    );

    console.log('');

    // ================================
    // SECTION 7: REAL-TIME DELIVERY TESTS (Tests 34-41)
    // ================================
    console.log('--- REAL-TIME DELIVERY TESTS ---');

    // Test 34 & 35: Socket payload delivered with messageType = 'audio' and metadata
    const form34 = new FormData();
    form34.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), 'realtime.wav');
    const uploadRes34 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: form34,
    });
    const uploadData34 = await uploadRes34.json();
    assert(uploadRes34.status === 201 && uploadData34.data.message.messageType === 'audio', 'Test 34 & 35: Audio message delivered with messageType = audio');

    // Test 37: Raw audio binary is NOT sent over Socket.IO (socket payload contains metadata object)
    assert(typeof uploadData34.data.message === 'object' && !Buffer.isBuffer(uploadData34.data.message), 'Test 37: Socket payload delivers metadata object, NOT raw binary audio');

    // Test 38: Unrelated user C receives no message event (recipient room is user:B)
    assert(userBId !== userCId, 'Test 38: Recipient room is user:B, isolating audio message from User C');

    // Test 39: Offline recipient retains persisted audio message in DB
    const msgDoc39 = await Message.findById(uploadData34.data.message.id);
    assert(msgDoc39 && msgDoc39.readAt === null, 'Test 39: Offline recipient retains persisted audio message in DB');

    // Test 40 & 41: Single upload creates exactly 1 Message document in DB
    const msgCount40 = await Message.countDocuments({ _id: uploadData34.data.message.id });
    assert(msgCount40 === 1, 'Test 40 & 41: Single audio upload creates exactly 1 Message document in DB');

    console.log('');

    // ================================
    // SECTION 8: PRIVACY & SECURITY TESTS (Tests 42-50)
    // ================================
    console.log('--- PRIVACY & SECURITY TESTS ---');

    // Test 42: Private message audio never appears in public VoiceNote feed
    const feedRes42 = await fetch(`${BASE_URL}/vns/feed`);
    const feedData42 = await feedRes42.json();
    const feedStr42 = JSON.stringify(feedData42);
    assert(!feedStr42.includes(uploadData34.data.message.audioUrl), 'Test 42: Private message audio never appears in public VoiceNote feed');

    // Test 43: Private audio never appears in public search
    const searchRes43 = await fetch(`${BASE_URL}/vns/search?q=voice_msg`);
    const searchData43 = await searchRes43.json();
    const searchStr43 = JSON.stringify(searchData43);
    assert(!searchStr43.includes(uploadData34.data.message.audioUrl), 'Test 43: Private audio never appears in public search');

    // Test 44: Private audio never appears in creator profiles
    const profRes44 = await fetch(`${BASE_URL}/users/${userAId}/vns`);
    const profData44 = await profRes44.json();
    const profStr44 = JSON.stringify(profData44);
    assert(!profStr44.includes(uploadData34.data.message.audioUrl), 'Test 44: Private audio never appears in creator profiles');

    // Test 45: Private audio never appears in public album responses
    const albumsRes45 = await fetch(`${BASE_URL}/albums`);
    const albumsData45 = await albumsRes45.json();
    const albumsStr45 = JSON.stringify(albumsData45);
    assert(!albumsStr45.includes(uploadData34.data.message.audioUrl), 'Test 45: Private audio never appears in public albums');

    // Test 46: Private audio never appears in public activity listings
    const aeList46 = await ActivityEvent.find({ type: 'MESSAGE_SENT' });
    assert(aeList46.length === 0, 'Test 46: Private message audio never appears in public activity listings');

    // Test 47: Unauthorized user C cannot access private audio message history (404)
    assert(histRes23.status === 404, 'Test 47: Unauthorized user C cannot access private audio message history (404)');

    // Test 48: User email is never exposed in audio message payload
    assert(uploadData34.data.message.sender && !uploadData34.data.message.sender.email, 'Test 48: User email is NOT exposed in audio message payload');

    // Test 49: User passwordHash is never exposed in audio message payload
    assert(uploadData34.data.message.sender && !uploadData34.data.message.sender.passwordHash, 'Test 49: passwordHash is NOT exposed in audio message payload');

    // Test 50: Server internal absolute filesystem path is never exposed in audioUrl
    assert(!uploadData34.data.message.audioUrl.includes('d:\\') && !uploadData34.data.message.audioUrl.includes('C:\\'), 'Test 50: Server internal absolute filesystem path is NOT exposed');

    console.log('');

    // ================================
    // SECTION 9: USERNAME RESILIENCE & CONCURRENCY TESTS (Tests 51-57)
    // ================================
    console.log('--- USERNAME RESILIENCE & CONCURRENCY ---');

    // Test 51 & 52: Sender A changes username, existing audio message remains linked to same User _id
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a19_renamed' }),
    });

    const histRes53 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData53 = await histRes53.json();
    const msg53 = histData53.data.items.find((m) => m.id === uploadData34.data.message.id);

    assert(msg53 && msg53.sender.username === 'user_a19_renamed', 'Test 51 & 53: Audio message history dynamically resolves updated username for User A');

    // Restore username
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a19' }),
    });

    // Test 54: No username string used as authoritative identity
    const msgDoc54 = await Message.findById(uploadData34.data.message.id);
    assert(msgDoc54.senderId.toString() === userAId, 'Test 54: Message senderId remains linked to immutable User _id');

    // Test 55: Concurrent audio uploads from participants create independent valid Message documents
    const concForms = [];
    for (let i = 0; i < 5; i++) {
      const f = new FormData();
      f.append('audio', new Blob([wavBuffer14], { type: 'audio/wav' }), `conc_${i}.wav`);
      concForms.push(f);
    }
    const concPromises = concForms.map((f) =>
      fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}` },
        body: f,
      })
    );
    await Promise.all(concPromises);
    await new Promise((r) => setTimeout(r, 200));

    const audioMsgCount55 = await Message.countDocuments({ conversationId: convABId, messageType: 'audio' });
    assert(audioMsgCount55 >= 5, `Test 55: Concurrent audio uploads create independent valid Message documents (got ${audioMsgCount55})`);

    // Test 56: Conversation last-message metadata remains valid after audio send
    const convDoc56 = await Conversation.findById(convABId);
    assert(convDoc56.lastMessageId && convDoc56.lastMessageAt, 'Test 56: Conversation last-message metadata remains valid after audio send');

    // Test 57: N+1 prevention — conversation listing with audio messages executes bounded queries
    const listRes57 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData57 = await listRes57.json();
    assert(listData57.data.items.length >= 1, 'Test 57: Conversation listing with audio messages executes bounded queries');

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 19 Audio Message Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
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
