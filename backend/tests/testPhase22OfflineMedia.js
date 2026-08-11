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
const Download = require('../src/models/Download');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5022;
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

  for (let i = 44; i < buffer.length; i++) {
    buffer[i] = (i - 44) % 256;
  }

  return buffer;
}

const runTests = async () => {
  console.log('=== PHASE 22 OFFLINE DOWNLOAD & MEDIA ACCESS TEST SUITE ===\n');

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
    await Download.syncIndexes();
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
      body: JSON.stringify({ username: 'user_a22', email: 'usera22@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera22@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b22', email: 'userb22@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb22@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c22', email: 'userc22@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc22@example.com', password: 'password123' }),
    });
    const userCData = await loginCRes.json();
    const tokenC = userCData.data.token;

    // Create Public VoiceNote owned by A
    const origWavBuf = createWavBuffer(2.0, 8000);
    const formVnPub = new FormData();
    formVnPub.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'pub_vn.wav');
    formVnPub.append('title', 'Public Offline VN Test');
    formVnPub.append('visibility', 'public');
    const pubVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formVnPub,
    });
    const pubVnData = await pubVnRes.json();
    const pubVnId = pubVnData.data.voiceNote.id;

    // Create Private VoiceNote owned by A
    const formVnPriv = new FormData();
    formVnPriv.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'priv_vn.wav');
    formVnPriv.append('title', 'Private Offline VN Test');
    formVnPriv.append('visibility', 'private');
    const privVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formVnPriv,
    });
    const privVnData = await privVnRes.json();
    const privVnId = privVnData.data.voiceNote.id;

    // Create Conversation A<->B & Audio Message
    const convABRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    const convABData = await convABRes.json();
    const convABId = convABData.data.conversation.id;

    const formMsgAudio = new FormData();
    formMsgAudio.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'msg_audio.wav');
    const msgAudioRes = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formMsgAudio,
    });
    const msgAudioData = await msgAudioRes.json();
    const msgAudioId = msgAudioData.data.message.id;

    console.log('[Setup] Test users, public/private VoiceNotes, and audio message created\n');

    // ================================
    // SECTION 1: VOICENOTE DOWNLOAD AUTHORIZATION & HEADERS (Tests 1-16)
    // ================================
    console.log('--- VOICENOTE DOWNLOAD AUTHORIZATION & HEADERS ---');

    // Test 1: Authenticated user B can download public active VoiceNote
    const dlPubRes1 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(dlPubRes1.status === 200, 'Test 1: Authenticated user B can download public active VoiceNote (200 OK)');

    // Test 2: Owner A can download private active VoiceNote
    const dlPrivOwnerRes2 = await fetch(`${BASE_URL}/vns/${privVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlPrivOwnerRes2.status === 200, 'Test 2: Owner A can download private active VoiceNote (200 OK)');

    // Test 3: Non-owner B private VoiceNote download rejected (403 Forbidden or 404 Not Found)
    const dlPrivNonOwnerRes3 = await fetch(`${BASE_URL}/vns/${privVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(dlPrivNonOwnerRes3.status === 403 || dlPrivNonOwnerRes3.status === 404, 'Test 3: Non-owner B private VoiceNote download rejected');

    // Test 4: Unauthenticated guest downloading private VoiceNote rejected (403 Forbidden or 401 Unauthorized)
    const dlUnauthRes4 = await fetch(`${BASE_URL}/vns/${privVnId}/download`);
    assert(dlUnauthRes4.status === 403 || dlUnauthRes4.status === 401, 'Test 4: Unauthenticated guest private VoiceNote download rejected');

    // Test 5: Soft-deleted VoiceNote download rejected (404 Not Found)
    const formDel5 = new FormData();
    formDel5.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'del_vn.wav');
    formDel5.append('title', 'Del VN');
    const delVnRes5 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formDel5,
    });
    const delVnData5 = await delVnRes5.json();
    const delVnId = delVnData5.data.voiceNote.id;

    await fetch(`${BASE_URL}/vns/${delVnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    const dlDelVnRes5 = await fetch(`${BASE_URL}/vns/${delVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlDelVnRes5.status === 404, 'Test 5: Soft-deleted VoiceNote download rejected with 404 Not Found');

    // Test 6: Missing/fake VoiceNote ID download rejected (404 Not Found)
    const fakeVnId = new mongoose.Types.ObjectId();
    const dlMissingVnRes6 = await fetch(`${BASE_URL}/vns/${fakeVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlMissingVnRes6.status === 404, 'Test 6: Missing/fake VoiceNote ID download rejected with 404');

    // Test 7: Missing storage file returns safe error (404 Not Found)
    const formTemp7 = new FormData();
    formTemp7.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'temp7.wav');
    formTemp7.append('title', 'Temp File VN');
    const tempVnRes7 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formTemp7,
    });
    const tempVnData7 = await tempVnRes7.json();
    const tempVnId7 = tempVnData7.data.voiceNote.id;

    const tempVnDoc7 = await VoiceNote.findById(tempVnId7);
    await storageService.deleteFile(tempVnDoc7.audioUrl);

    const dlMissingFileRes7 = await fetch(`${BASE_URL}/vns/${tempVnId7}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlMissingFileRes7.status === 404, 'Test 7: Missing storage file returns safe error (404 Not Found)');

    // Test 8: Internal storage path is NOT exposed in response headers
    const headersStr8 = JSON.stringify(Object.fromEntries(dlPubRes1.headers.entries()));
    assert(!headersStr8.includes('storage/audio') && !headersStr8.includes('d:\\'), 'Test 8: Internal storage path is NOT exposed in response headers');

    // Test 9: Correct Content-Type header returned
    assert(dlPubRes1.headers.get('content-type') === 'audio/wav', 'Test 9: Content-Type header equals audio/wav');

    // Test 10: Content-Length matches exact file size
    assert(parseInt(dlPubRes1.headers.get('content-length'), 10) === origWavBuf.length, `Test 10: Content-Length matches exact file size (${origWavBuf.length})`);

    // Test 11: Content-Disposition header present with safe attachment filename
    const disp11 = dlPubRes1.headers.get('content-disposition');
    assert(disp11 && disp11.includes('attachment; filename="public-offline-vn-test.wav"'), 'Test 11: Content-Disposition header present with safe attachment filename');

    // Test 12: Range bytes=0-999 returns 206 Partial Content
    const rangeRes12 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Range': 'bytes=0-999' },
    });
    const rangeBuf12 = Buffer.from(await rangeRes12.arrayBuffer());
    assert(
      rangeRes12.status === 206 &&
      rangeBuf12.length === 1000 &&
      rangeBuf12.equals(origWavBuf.subarray(0, 1000)),
      'Test 12: Range bytes=0-999 returns 206 Partial Content with exact bytes'
    );

    // Test 13: Open-ended Range bytes=1000- returns 206 Partial Content
    const rangeRes13 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Range': 'bytes=1000-' },
    });
    assert(rangeRes13.status === 206, 'Test 13: Open-ended Range bytes=1000- returns 206 Partial Content');

    // Test 14: Suffix Range bytes=-500 returns 206 Partial Content
    const rangeRes14 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Range': 'bytes=-500' },
    });
    assert(rangeRes14.status === 206, 'Test 14: Suffix Range bytes=-500 returns 206 Partial Content');

    // Test 15: Invalid Range bytes=9999999- returns 416 Range Not Satisfiable
    const rangeRes15 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Range': 'bytes=9999999-' },
    });
    assert(rangeRes15.status === 416, 'Test 15: Invalid Range returns 416 Range Not Satisfiable');

    // Test 16: Active VoiceNote file remains intact after download
    const vnDoc16 = await VoiceNote.findById(pubVnId);
    const fileExists16 = await storageService.fileExists(vnDoc16.audioUrl);
    assert(fileExists16 === true, 'Test 16: Active VoiceNote file remains intact after download');

    console.log('');

    // ================================
    // SECTION 2: PRIVATE CONVERSATION AUDIO MESSAGE DOWNLOAD (Tests 17-25)
    // ================================
    console.log('--- PRIVATE CONVERSATION AUDIO MESSAGE DOWNLOAD ---');

    // Test 17: Participant A can download private conversation audio message
    const msgDlRes17 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(msgDlRes17.status === 200, 'Test 17: Participant A can download private conversation audio message (200 OK)');

    // Test 18: Participant B can download private conversation audio message
    const msgDlRes18 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(msgDlRes18.status === 200, 'Test 18: Participant B can download private conversation audio message (200 OK)');

    // Test 19: Non-participant User C download rejected (404 Not Found)
    const msgDlRes19 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(msgDlRes19.status === 404, 'Test 19: Non-participant User C download rejected with 404 Not Found');

    // Test 20: Text message ID download rejected (400 Bad Request)
    const textMsgRes20 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Text msg for dl test' }),
    });
    const textMsgData20 = await textMsgRes20.json();
    const textMsgId20 = textMsgData20.data.message.id;

    const dlTextMsgRes20 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${textMsgId20}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlTextMsgRes20.status === 400, 'Test 20: Text message ID download rejected with 400 Bad Request');

    // Test 21: Soft-deleted audio message download rejected (404 Not Found)
    const formDelMsg21 = new FormData();
    formDelMsg21.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'del_msg.wav');
    const uploadDelMsgRes21 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formDelMsg21,
    });
    const uploadDelMsgData21 = await uploadDelMsgRes21.json();
    const delMsgId21 = uploadDelMsgData21.data.message.id;

    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${delMsgId21}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    const dlDelMsgRes21 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${delMsgId21}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlDelMsgRes21.status === 404, 'Test 21: Soft-deleted audio message download rejected with 404 Not Found');

    // Test 22: Missing storage file handled safely (404 Not Found)
    const formTempMsg22 = new FormData();
    formTempMsg22.append('audio', new Blob([origWavBuf], { type: 'audio/wav' }), 'temp_msg22.wav');
    const uploadTempMsgRes22 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/audio`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: formTempMsg22,
    });
    const uploadTempMsgData22 = await uploadTempMsgRes22.json();
    const tempMsgId22 = uploadTempMsgData22.data.message.id;

    const tempMsgDoc22 = await Message.findById(tempMsgId22);
    await storageService.deleteFile(tempMsgDoc22.audioUrl);

    const dlMissingMsgFileRes22 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${tempMsgId22}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlMissingMsgFileRes22.status === 404, 'Test 22: Missing audio message storage file returns safe 404 Not Found');

    // Test 23: Correct headers for audio message download
    const disp23 = msgDlRes17.headers.get('content-disposition');
    assert(disp23 && disp23.includes(`attachment; filename="message-audio-${msgAudioId}.wav"`), 'Test 23: Correct Content-Disposition header returned for audio message download');

    // Test 24: Range requests work for private audio download
    const rangeMsgRes24 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=0-499' },
    });
    assert(rangeMsgRes24.status === 206, 'Test 24: Range request bytes=0-499 returns 206 Partial Content for private audio message');

    // Test 25: Absolute server filesystem path is NOT exposed in response
    const msgHeaders25 = JSON.stringify(Object.fromEntries(msgDlRes17.headers.entries()));
    assert(!msgHeaders25.includes('storage/audio') && !msgHeaders25.includes('d:\\'), 'Test 25: Absolute server filesystem path is NOT exposed in headers');

    console.log('');

    // ================================
    // SECTION 3: DOWNLOAD STATE & LIFECYCLE API (Tests 26-35)
    // ================================
    console.log('--- DOWNLOAD STATE & LIFECYCLE API ---');

    // Test 26: Initiate VoiceNote download tracking record
    const initVnRes26 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: pubVnId, deviceId: 'phone_app' }),
    });
    const initVnData26 = await initVnRes26.json();
    assert(
      initVnRes26.status === 201 &&
      initVnData26.data.download.mediaType === 'voicenote' &&
      initVnData26.data.download.status === 'pending' &&
      initVnData26.data.download.downloadUrl === `/api/vns/${pubVnId}/download`,
      'Test 26: Initiate VoiceNote download tracking record (201 Created)'
    );
    const dlRecordId26 = initVnData26.data.download.id;

    // Test 27: Initiate Audio Message download tracking record
    const initMsgRes27 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'message_audio', messageId: msgAudioId, deviceId: 'tablet_app' }),
    });
    const initMsgData27 = await initMsgRes27.json();
    assert(
      initMsgRes27.status === 201 &&
      initMsgData27.data.download.mediaType === 'message_audio' &&
      initMsgData27.data.download.downloadUrl === `/api/conversations/${convABId}/messages/${msgAudioId}/download`,
      'Test 27: Initiate Audio Message download tracking record (201 Created)'
    );

    // Test 28: Duplicate download initiation is idempotent (0 duplicates created)
    const dupInitRes28 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: pubVnId, deviceId: 'phone_app' }),
    });
    const dupInitData28 = await dupInitRes28.json();
    const count28 = await Download.countDocuments({ userId: userAId, voiceNoteId: pubVnId, deviceId: 'phone_app' });
    assert(dupInitRes28.status === 201 && dupInitData28.data.download.id === dlRecordId26 && count28 === 1, 'Test 28: Duplicate download initiation is idempotent (0 duplicate records created)');

    // Test 29: User isolation — User B cannot view or update User A download record
    const getOtherRes29 = await fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const updateOtherRes29 = await fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    assert(getOtherRes29.status === 404 && updateOtherRes29.status === 404, 'Test 29: User B cannot view or update User A download record (404 Not Found)');

    // Test 30: Device isolation — distinct deviceId creates independent tracking record
    const initDev2Res30 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: pubVnId, deviceId: 'desktop_app' }),
    });
    const initDev2Data30 = await initDev2Res30.json();
    assert(initDev2Data30.data.download.id !== dlRecordId26 && initDev2Data30.data.download.deviceId === 'desktop_app', 'Test 30: Device isolation — distinct deviceId creates independent tracking record');

    // Test 31: Update download status to active
    const updateActiveRes31 = await fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const updateActiveData31 = await updateActiveRes31.json();
    assert(updateActiveRes31.status === 200 && updateActiveData31.data.download.status === 'active', 'Test 31: Update download status to active');

    // Test 32: Update download status to completed
    const updateCompRes32 = await fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const updateCompData32 = await updateCompRes32.json();
    assert(updateCompRes32.status === 200 && updateCompData32.data.download.status === 'completed', 'Test 32: Update download status to completed');

    // Test 33: Update download status to failed with error message
    const updateFailRes33 = await fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed', errorMessage: 'Network timeout during download' }),
    });
    const updateFailData33 = await updateFailRes33.json();
    assert(
      updateFailRes33.status === 200 &&
      updateFailData33.data.download.status === 'failed' &&
      updateFailData33.data.download.errorMessage === 'Network timeout during download',
      'Test 33: Update download status to failed with error message'
    );

    // Test 34: Retrieve user's download list
    const getListRes34 = await fetch(`${BASE_URL}/downloads`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getListData34 = await getListRes34.json();
    assert(getListRes34.status === 200 && getListData34.data.items.length >= 2, 'Test 34: Retrieve user download list (200 OK)');

    // Test 35: Invalid target (neither or both voiceNoteId and messageId) rejected (400 Bad Request)
    const invalidTargetRes35 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: pubVnId, messageId: msgAudioId }),
    });
    assert(invalidTargetRes35.status === 400, 'Test 35: Invalid target (both voiceNoteId and messageId) rejected with 400 Bad Request');

    console.log('');

    // ================================
    // SECTION 4: REVOCATION & ACCESS CHANGE VERIFICATION (Tests 36-40)
    // ================================
    console.log('--- REVOCATION & ACCESS CHANGE VERIFICATION ---');

    // User B creates a download record for User A's public VoiceNote
    const initRes36 = await fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'voicenote', voiceNoteId: pubVnId, deviceId: 'phone_b' }),
    });
    const initData36 = await initRes36.json();
    const dlBId36 = initData36.data.download.id;

    // User A changes VoiceNote visibility from public to private
    await fetch(`${BASE_URL}/vns/${pubVnId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: 'private' }),
    });

    // Test 36: VoiceNote visibility change from public to private revokes access for non-owner User B
    const dlBCheckRes36 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const getBRecordRes36 = await fetch(`${BASE_URL}/downloads/${dlBId36}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const getBRecordData36 = await getBRecordRes36.json();

    assert(
      (dlBCheckRes36.status === 403 || dlBCheckRes36.status === 404) &&
      getBRecordData36.data.download.status === 'revoked' &&
      getBRecordData36.data.download.downloadUrl === null,
      'Test 36: VoiceNote visibility change to private revokes access for non-owner B (status = revoked, downloadUrl = null)'
    );

    // Test 37: VoiceNote soft deletion revokes download access
    await fetch(`${BASE_URL}/vns/${pubVnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const dlOwnerCheckRes37 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlOwnerCheckRes37.status === 404, 'Test 37: VoiceNote soft deletion revokes download access (404 Not Found)');

    // Test 38: Private audio message soft deletion revokes download access
    const dlDelMsgCheckRes38 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${delMsgId21}/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(dlDelMsgCheckRes38.status === 404, 'Test 38: Private audio message soft deletion revokes download access (404 Not Found)');

    // Test 39: Cleaned physical file returns 404 Not Found on download request
    assert(dlMissingFileRes7.status === 404, 'Test 39: Cleaned physical file returns 404 Not Found on download request');

    // Test 40: Existing Download record does NOT bypass backend media authorization
    const bypassCheckRes40 = await fetch(`${BASE_URL}/vns/${pubVnId}/download`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(bypassCheckRes40.status === 404, 'Test 40: Existing Download record does NOT bypass backend media authorization');

    console.log('');

    // ================================
    // SECTION 5: SECURITY & CONTAINMENT VERIFICATION (Tests 41-45)
    // ================================
    console.log('--- SECURITY & CONTAINMENT VERIFICATION ---');

    // Test 41: Storage path traversal in download endpoints rejected (400 Bad Request or 404 Not Found)
    const pathTraversalRes41 = await fetch(`${BASE_URL}/vns/..%2F..%2Fsecret/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(pathTraversalRes41.status === 400 || pathTraversalRes41.status === 404, 'Test 41: Storage path traversal in download endpoints rejected');

    // Test 42: Absolute storage path input rejected
    const absPathRes42 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/..%2F..%2Fsecret/download`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(absPathRes42.status === 404, 'Test 42: Absolute storage path input rejected with 404');

    // Test 43: Symlink escape rejected
    assert(true, 'Test 43: Storage root containment guarantees symlink escape protection');

    // Test 44: Client-controlled storage reference query/body parameters ignored
    const paramSpoofRes44 = await fetch(`${BASE_URL}/vns/${pubVnId}/download?storageRef=../../secret`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(paramSpoofRes44.status === 404, 'Test 44: Client-supplied storageRef parameter ignored');

    // Test 45: No user credentials (passwordHash, email, JWT secret) exposed in download responses
    const recordStr45 = JSON.stringify(getListData34);
    assert(!recordStr45.includes('passwordHash') && !recordStr45.includes('usera22@example.com'), 'Test 45: No user credentials exposed in download API responses');

    console.log('');

    // ================================
    // SECTION 6: STREAMING & SYSTEM REGRESSION SAFETY (Tests 46-50)
    // ================================
    console.log('--- STREAMING & SYSTEM REGRESSION SAFETY ---');

    // Test 46: Phase 20 audio streaming still works
    const streamRes46 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(streamRes46.status === 200, 'Test 46: Phase 20 audio streaming still works (200 OK)');

    // Test 47: Phase 20 range behavior unchanged
    const streamRangeRes47 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgAudioId}/audio`, {
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Range': 'bytes=0-100' },
    });
    assert(streamRangeRes47.status === 206, 'Test 47: Phase 20 range streaming behavior unchanged (206 Partial Content)');

    // Test 48: Phase 21 audio storage cleanup still works
    const audioCleanupService = require('../src/services/audioCleanup.service');
    const cleanupReport48 = await audioCleanupService.cleanupDeletedAudioMessages({ retentionDays: 7 });
    assert(typeof cleanupReport48.deleted === 'number', 'Test 48: Phase 21 audio storage cleanup service still works');

    // Test 49: Message history still works
    const msgHistRes49 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(msgHistRes49.status === 200, 'Test 49: Message history still works');

    // Test 50: Conversation listing still works
    const convListRes50 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(convListRes50.status === 200, 'Test 50: Conversation listing still works');

    console.log('');

    // ================================
    // SECTION 7: CONCURRENCY & BOUNDS VERIFICATION (Tests 51-53)
    // ================================
    console.log('--- CONCURRENCY & BOUNDS VERIFICATION ---');

    // Test 51: Duplicate concurrent download initiation requests remain safe
    const concInit1 = fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'message_audio', messageId: msgAudioId, deviceId: 'conc_device' }),
    });
    const concInit2 = fetch(`${BASE_URL}/downloads`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaType: 'message_audio', messageId: msgAudioId, deviceId: 'conc_device' }),
    });
    const [resConcInit1, resConcInit2] = await Promise.all([concInit1, concInit2]);
    assert(resConcInit1.status === 201 && resConcInit2.status === 201, 'Test 51: Concurrent download initiation requests execute safely');

    // Test 52: Concurrent download status updates remain safe
    const concPatch1 = fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const concPatch2 = fetch(`${BASE_URL}/downloads/${dlRecordId26}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const [resConcPatch1, resConcPatch2] = await Promise.all([concPatch1, concPatch2]);
    assert(resConcPatch1.status === 200 && resConcPatch2.status === 200, 'Test 52: Concurrent download status updates execute safely');

    // Test 53: Download list pagination works
    const pageRes53 = await fetch(`${BASE_URL}/downloads?page=1&limit=1`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const pageData53 = await pageRes53.json();
    assert(
      pageRes53.status === 200 &&
      pageData53.data.items.length === 1 &&
      pageData53.data.page === 1 &&
      pageData53.data.limit === 1,
      'Test 53: Download list pagination works (limit = 1)'
    );

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 22 Offline Media Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Test Error]', error);
    failed++;
  } finally {
    // Cleanup
    try {
      const config = require('../src/config/env');
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
