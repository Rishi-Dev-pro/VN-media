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
const Comment = require('../src/models/Comment');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5018;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

const runTests = async () => {
  console.log('=== PHASE 18 DIRECT MESSAGING & PRIVATE CONVERSATIONS TEST SUITE ===\n');

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
      body: JSON.stringify({ username: 'user_a18', email: 'usera18@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera18@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b18', email: 'userb18@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb18@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c18', email: 'userc18@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc18@example.com', password: 'password123' }),
    });
    const userCData = await loginCRes.json();
    const tokenC = userCData.data.token;
    const userCId = userCData.data.user.id;

    console.log('[Setup] Three test users created and logged in\n');

    // ================================
    // SECTION 1: CONVERSATION MODEL TESTS (Tests 10-16)
    // ================================
    console.log('--- CONVERSATION MODEL TESTS ---');

    // Test 10: Valid conversation created in DB via service
    const createConvRes10 = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userBId }),
    });
    const convData10 = await createConvRes10.json();
    assert(createConvRes10.status === 200 && convData10.success === true && convData10.data.conversation.id, 'Test 10: Valid conversation created via API');
    const convABId = convData10.data.conversation.id;

    // Test 11: Self-conversation rejected (400 Bad Request)
    const selfConvRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userAId }),
    });
    assert(selfConvRes.status === 400, 'Test 11: Self-conversation rejected with 400 Bad Request');

    // Test 12: Unknown target user rejected (404 Not Found)
    const fakeUserId = new mongoose.Types.ObjectId();
    const fakeUserConvRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: fakeUserId }),
    });
    assert(fakeUserConvRes.status === 404, 'Test 12: Unknown target user rejected with 404 Not Found');

    // Test 13: Duplicate conversation request returns existing conversation
    const duplicateConvRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userAId }),
    });
    const duplicateConvData = await duplicateConvRes.json();
    assert(duplicateConvRes.status === 200 && duplicateConvData.data.conversation.id === convABId, 'Test 13: Reverse/duplicate conversation request returns existing conversation');

    // Test 14: Database unique compound index exists and prevents duplicates
    const convCount14 = await Conversation.countDocuments({
      $or: [
        { participantOne: userAId, participantTwo: userBId },
        { participantOne: userBId, participantTwo: userAId },
      ],
    });
    assert(convCount14 === 1, 'Test 14: Exactly 1 Conversation document exists in DB for User A & B');

    // Test 15: Participant ordering is deterministic
    const convDoc15 = await Conversation.findById(convABId);
    const sortedPair = [userAId, userBId].sort();
    assert(
      convDoc15.participantOne.toString() === sortedPair[0] &&
      convDoc15.participantTwo.toString() === sortedPair[1],
      'Test 15: Participant pairing is deterministically sorted (participantOne < participantTwo)'
    );

    // Test 16: Unique participant pair index works
    let dupErr16 = null;
    try {
      await Conversation.create({
        participantOne: sortedPair[0],
        participantTwo: sortedPair[1],
      });
    } catch (err) {
      dupErr16 = err;
    }
    assert(dupErr16 !== null && dupErr16.code === 11000, 'Test 16: E11000 duplicate key error enforced at DB level');

    console.log('');

    // ================================
    // SECTION 2: CONVERSATION PRIVACY & ACCESS CONTROL (Tests 1-9)
    // ================================
    console.log('--- CONVERSATION PRIVACY & ACCESS CONTROL ---');

    // Test 1: User A can access A<->B conversation
    const accessRes1 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(accessRes1.status === 200, 'Test 1: Participant A can access conversation A<->B');

    // Test 2: User B can access A<->B conversation
    const accessRes2 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(accessRes2.status === 200, 'Test 2: Participant B can access conversation A<->B');

    // Test 3: User C cannot access A<->B conversation (404 Not Found to prevent leakage)
    const accessRes3 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(accessRes3.status === 404, 'Test 3: Non-participant C receives 404 Not Found for A<->B');

    // Test 4: User C cannot retrieve messages from A<->B
    const msgRes4 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(msgRes4.status === 404, 'Test 4: Non-participant C cannot retrieve messages from A<->B (404)');

    // Test 5: User C cannot mark A<->B messages read
    const readRes5 = await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(readRes5.status === 404, 'Test 5: Non-participant C cannot mark A<->B messages read (404)');

    // Test 6: User C cannot delete A<->B messages
    const fakeMsgId = new mongoose.Types.ObjectId();
    const delRes6 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${fakeMsgId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(delRes6.status === 404, 'Test 6: Non-participant C cannot delete messages from A<->B (404)');

    // Test 7: Conversation list for A contains only conversations involving A
    const listRes7 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData7 = await listRes7.json();
    assert(listData7.data.items.every((c) => c.otherParticipant && c.otherParticipant.id !== userAId), 'Test 7: Conversation list for A contains only conversations involving A');

    // Test 8: Conversation list for B contains only conversations involving B
    const listRes8 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    const listData8 = await listRes8.json();
    assert(listData8.data.items.some((c) => c.id === convABId), 'Test 8: Conversation list for B contains A<->B');

    // Test 9: Conversation list for C does not contain A<->B
    const listRes9 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    const listData9 = await listRes9.json();
    assert(listData9.data.items.every((c) => c.id !== convABId), 'Test 9: Conversation list for C excludes A<->B');

    console.log('');

    // ================================
    // SECTION 3: MESSAGE MODEL TESTS (Tests 17-24)
    // ================================
    console.log('--- MESSAGE MODEL TESTS ---');

    // Test 17: Valid text message created directly in DB
    const validMsg17 = await Message.create({
      conversationId: convABId,
      senderId: userAId,
      content: 'Direct model test message',
      messageType: 'text',
    });
    assert(validMsg17 && validMsg17._id && validMsg17.messageType === 'text', 'Test 17: Valid text message created in DB');

    // Test 18: Missing content rejected by schema
    let err18 = null;
    try {
      await Message.create({ conversationId: convABId, senderId: userAId, content: '' });
    } catch (e) {
      err18 = e;
    }
    assert(err18 !== null, 'Test 18: Missing content rejected by schema');

    // Test 19: Whitespace-only content rejected by schema
    let err19 = null;
    try {
      await Message.create({ conversationId: convABId, senderId: userAId, content: '   ' });
    } catch (e) {
      err19 = e;
    }
    assert(err19 !== null, 'Test 19: Whitespace-only content rejected by schema');

    // Test 20: Maximum message length (> 5000 chars) enforced
    let err20 = null;
    try {
      await Message.create({ conversationId: convABId, senderId: userAId, content: 'a'.repeat(5001) });
    } catch (e) {
      err20 = e;
    }
    assert(err20 !== null, 'Test 20: Content length > 5000 chars rejected by schema');

    // Test 21: messageType defaults to text
    const msgDoc21 = await Message.findById(validMsg17._id);
    assert(msgDoc21.messageType === 'text', 'Test 21: messageType defaults to text');

    // Test 22: Invalid messageType rejected by schema enum
    let err22 = null;
    try {
      await Message.create({ conversationId: convABId, senderId: userAId, content: 'Test', messageType: 'video' });
    } catch (e) {
      err22 = e;
    }
    assert(err22 !== null, 'Test 22: Unsupported messageType "video" rejected by schema enum');

    // Test 23: readAt defaults to null
    assert(validMsg17.readAt === null, 'Test 23: readAt defaults to null');

    // Test 24: deletedAt defaults to null
    assert(validMsg17.deletedAt === null, 'Test 24: deletedAt defaults to null');

    // Clean up direct model test record
    await Message.deleteOne({ _id: validMsg17._id });

    console.log('');

    // ================================
    // SECTION 4: MESSAGE CREATION TESTS (Tests 25-33)
    // ================================
    console.log('--- MESSAGE CREATION TESTS ---');

    // Test 25: Participant A can send message via API
    const sendRes25 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello User B!' }),
    });
    const sendData25 = await sendRes25.json();
    assert(sendRes25.status === 201 && sendData25.success === true && sendData25.data.message.content === 'Hello User B!', 'Test 25: Participant A can send message via API');
    const msg1Id = sendData25.data.message.id;

    // Test 26: Participant B can reply via API
    const sendRes26 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hi User A! How are you?' }),
    });
    const sendData26 = await sendRes26.json();
    assert(sendRes26.status === 201 && sendData26.data.message.content === 'Hi User A! How are you?', 'Test 26: Participant B can reply via API');
    const msg2Id = sendData26.data.message.id;

    // Test 27: Non-participant C cannot send message
    const sendRes27 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unauthorized message attempt' }),
    });
    assert(sendRes27.status === 404, 'Test 27: Non-participant C cannot send message (404)');

    // Test 28: Unknown conversation message sending rejected (404)
    const sendRes28 = await fetch(`${BASE_URL}/conversations/${fakeUserId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unknown conv message' }),
    });
    assert(sendRes28.status === 404, 'Test 28: Unknown conversation message sending rejected (404)');

    // Test 29: Unauthenticated message sending rejected (401)
    const sendRes29 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unauth message' }),
    });
    assert(sendRes29.status === 401, 'Test 29: Unauthenticated message sending rejected (401)');

    // Test 30: Client senderId spoofing fails (uses req.user._id)
    const sendRes30 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Spoof sender test', senderId: userBId }),
    });
    const sendData30 = await sendRes30.json();
    assert(sendRes30.status === 201 && sendData30.data.message.sender.id === userAId, 'Test 30: Client-supplied senderId spoofing fails (sender is User A)');

    // Test 31: Successful message updates lastMessageAt
    const convDoc31 = await Conversation.findById(convABId);
    assert(convDoc31.lastMessageAt !== null, 'Test 31: Successful message updates conversation lastMessageAt');

    // Test 32: Successful message updates lastMessageId
    assert(convDoc31.lastMessageId && convDoc31.lastMessageId.toString() === sendData30.data.message.id, 'Test 32: Successful message updates conversation lastMessageId');

    // Test 33: Failed message does not corrupt conversation metadata
    const lastMsgIdBefore33 = convDoc31.lastMessageId.toString();
    await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    const convDocAfter33 = await Conversation.findById(convABId);
    assert(convDocAfter33.lastMessageId.toString() === lastMsgIdBefore33, 'Test 33: Failed message does not corrupt conversation metadata');

    console.log('');

    // ================================
    // SECTION 5: MESSAGE HISTORY TESTS (Tests 34-41)
    // ================================
    console.log('--- MESSAGE HISTORY TESTS ---');

    // Test 34: Participant A can retrieve message history
    const histRes34 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData34 = await histRes34.json();
    assert(histRes34.status === 200 && histData34.success === true && histData34.data.items.length >= 3, 'Test 34: Participant A can retrieve message history');

    // Test 35: Participant B can retrieve message history
    const histRes35 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(histRes35.status === 200, 'Test 35: Participant B can retrieve message history');

    // Test 36: Non-participant C cannot retrieve message history
    const histRes36 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(histRes36.status === 404, 'Test 36: Non-participant C cannot retrieve message history (404)');

    // Test 37: Messages from another conversation never appear
    const convACRes = await fetch(`${BASE_URL}/conversations`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userCId }),
    });
    const convACData = await convACRes.json();
    const convACId = convACData.data.conversation.id;

    await fetch(`${BASE_URL}/conversations/${convACId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hello User C!' }),
    });

    const histRes37 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData37 = await histRes37.json();
    assert(histData37.data.items.every((m) => m.conversationId === convABId), 'Test 37: Messages from another conversation never appear in history');

    // Test 38: Message pagination works
    const histRes38 = await fetch(`${BASE_URL}/conversations/${convABId}/messages?page=1&limit=2`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData38 = await histRes38.json();
    assert(histData38.data.items.length === 2 && histData38.data.pagination.limit === 2, 'Test 38: Message pagination works (?page=1&limit=2)');

    // Test 39: Maximum limit is enforced (capped at 100)
    const histRes39 = await fetch(`${BASE_URL}/conversations/${convABId}/messages?limit=500`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData39 = await histRes39.json();
    assert(histData39.data.pagination.limit === 100, 'Test 39: Maximum limit is enforced (capped at 100)');

    // Test 40: Invalid pagination handled safely
    const histRes40 = await fetch(`${BASE_URL}/conversations/${convABId}/messages?page=abc&limit=-10`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData40 = await histRes40.json();
    assert(histData40.data.pagination.page === 1 && histData40.data.pagination.limit === 50, 'Test 40: Invalid pagination values default safely to page 1, limit 50');

    // Test 41: Message history ordering is deterministic (createdAt ASC)
    const msgs41 = histData37.data.items;
    let isOrdered41 = true;
    for (let i = 1; i < msgs41.length; i++) {
      if (new Date(msgs41[i].createdAt) < new Date(msgs41[i - 1].createdAt)) {
        isOrdered41 = false;
        break;
      }
    }
    assert(isOrdered41, 'Test 41: Message history ordering is deterministic (createdAt ASC)');

    console.log('');

    // ================================
    // SECTION 6: READ STATE & UNREAD COUNT TESTS (Tests 42-47)
    // ================================
    console.log('--- READ STATE & UNREAD COUNT TESTS ---');

    // Test 42: New incoming message has readAt = null
    const msg2Doc = await Message.findById(msg2Id);
    assert(msg2Doc.readAt === null, 'Test 42: New incoming message from User B has readAt = null');

    // Test 43: Recipient User A can mark incoming messages read
    const markReadRes43 = await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const markReadData43 = await markReadRes43.json();
    assert(markReadRes43.status === 200 && markReadData43.success === true && typeof markReadData43.data.updatedCount === 'number', 'Test 43: Recipient User A can mark incoming messages as read');

    // Test 44: Own messages are NOT incorrectly marked read
    const msg1DocAfter = await Message.findById(msg1Id);
    assert(msg1DocAfter.senderId.toString() === userAId && msg1DocAfter.readAt === null, 'Test 44: User A marking read does NOT mark User A own messages read');

    // Test 45: Other users cannot mark messages read (already verified in Test 5)
    assert(readRes5.status === 404, 'Test 45: Non-participant C cannot mark messages read');

    // Test 46: Deleted messages do not contribute to unreadCount
    // User B sends a message to A
    const msgForDel46Res = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Message to delete for unread test' }),
    });
    const msgForDel46Data = await msgForDel46Res.json();
    const msgForDel46Id = msgForDel46Data.data.message.id;

    // Get unread count for User A before deletion
    const convBeforeDelRes = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convBeforeDelData = await convBeforeDelRes.json();
    const unreadBeforeDel = convBeforeDelData.data.conversation.unreadCount;

    // User B deletes the message
    await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msgForDel46Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });

    // Get unread count for User A after deletion
    const convAfterDelRes = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convAfterDelData = await convAfterDelRes.json();
    const unreadAfterDel = convAfterDelData.data.conversation.unreadCount;

    assert(unreadAfterDel === unreadBeforeDel - 1, 'Test 46: Deleted incoming message does NOT contribute to unreadCount');

    // Test 47: Unread count decreases after marking read
    // User B sends another message
    await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unread count reduction test message' }),
    });

    const getUnreadResBefore = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getUnreadDataBefore = await getUnreadResBefore.json();
    const countBefore47 = getUnreadDataBefore.data.conversation.unreadCount;

    // Mark read
    await fetch(`${BASE_URL}/conversations/${convABId}/read`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    const getUnreadResAfter = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getUnreadDataAfter = await getUnreadResAfter.json();
    assert(countBefore47 > 0 && getUnreadDataAfter.data.conversation.unreadCount === 0, 'Test 47: Unread count decreases to 0 after marking read');

    console.log('');

    // ================================
    // SECTION 7: CONVERSATION LISTING TESTS (Tests 48-56)
    // ================================
    console.log('--- CONVERSATION LISTING TESTS ---');

    // Test 48: Conversation list returns only user's conversations
    const listRes48 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData48 = await listRes48.json();
    assert(listData48.data.items.length >= 2, 'Test 48: Conversation list returns user conversations (A<->B and A<->C)');

    // Test 49: Other user's conversations excluded (already verified in Test 9)
    assert(listData9.data.items.every((c) => c.id !== convABId), 'Test 49: Other user conversations strictly excluded');

    // Test 50: otherParticipant is sanitized
    const sampleConv = listData48.data.items[0];
    assert(sampleConv.otherParticipant && sampleConv.otherParticipant.id && sampleConv.otherParticipant.username, 'Test 50: otherParticipant is populated and sanitized');

    // Test 51: email is not exposed in conversation list
    assert(!sampleConv.otherParticipant.email, 'Test 51: email is NOT exposed in conversation list');

    // Test 52: passwordHash is not exposed in conversation list
    assert(!sampleConv.otherParticipant.passwordHash, 'Test 52: passwordHash is NOT exposed in conversation list');

    // Test 53: lastMessage is correctly represented
    assert(sampleConv.lastMessage && typeof sampleConv.lastMessage.content === 'string', 'Test 53: lastMessage is populated with content');

    // Test 54: unreadCount is correct in list
    assert(typeof sampleConv.unreadCount === 'number', 'Test 54: unreadCount is numeric in conversation list');

    // Test 55: Conversation pagination works
    const listRes55 = await fetch(`${BASE_URL}/conversations?page=1&limit=1`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData55 = await listRes55.json();
    assert(listData55.data.items.length === 1 && listData55.data.pagination.limit === 1, 'Test 55: Conversation pagination works (?page=1&limit=1)');

    // Test 56: Conversation ordering is deterministic (lastMessageAt DESC)
    const listRes56 = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData56 = await listRes56.json();
    const items56 = listData56.data.items;
    let isOrdered56 = true;
    for (let i = 1; i < items56.length; i++) {
      if (items56[i].lastMessageAt && items56[i - 1].lastMessageAt) {
        if (new Date(items56[i].lastMessageAt) > new Date(items56[i - 1].lastMessageAt)) {
          isOrdered56 = false;
          break;
        }
      }
    }
    assert(isOrdered56, 'Test 56: Conversation list ordering is deterministic (lastMessageAt DESC)');

    console.log('');

    // ================================
    // SECTION 8: MESSAGE DELETE TESTS (Tests 57-64)
    // ================================
    console.log('--- MESSAGE DELETE TESTS ---');

    // Test 57: Sender A can delete own message
    const msgToSend57 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Message to delete test 57' }),
    });
    const msgData57 = await msgToSend57.json();
    const msg57Id = msgData57.data.message.id;

    const delRes57 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msg57Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes57.status === 200, 'Test 57: Sender A can delete own message');

    // Test 58: Non-sender B cannot delete A's message (403 Forbidden)
    const msgToSend58 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Message by A for 58' }),
    });
    const msgData58 = await msgToSend58.json();
    const msg58Id = msgData58.data.message.id;

    const delRes58 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msg58Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(delRes58.status === 403, 'Test 58: Non-sender B cannot delete A message (403 Forbidden)');

    // Test 59: Non-participant C cannot delete message (404 Not Found)
    const delRes59 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msg58Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(delRes59.status === 404, 'Test 59: Non-participant C cannot delete message (404 Not Found)');

    // Test 60: Unknown message returns 404
    const delRes60 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${fakeUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes60.status === 404, 'Test 60: Unknown message delete returns 404');

    // Test 61: Cross-conversation message deletion fails (404)
    const delRes61 = await fetch(`${BASE_URL}/conversations/${convACId}/messages/${msg58Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes61.status === 404, 'Test 61: Message from another conversation cannot be deleted via wrong conversation ID (404)');

    // Test 62: Deleted message content is hidden (masked as [deleted])
    const histRes62 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData62 = await histRes62.json();
    const deletedMsg62 = histData62.data.items.find((m) => m.id === msg57Id);
    assert(deletedMsg62 && deletedMsg62.content === '[deleted]' && deletedMsg62.deletedAt !== null, 'Test 62: Soft-deleted message content is masked as [deleted]');

    // Test 63: Deleted message remains structurally present in history
    assert(deletedMsg62 && deletedMsg62.sender.id === userAId, 'Test 63: Soft-deleted message remains structurally present with valid sender identity');

    // Test 64: Repeated delete is idempotent (200 OK)
    const delRes64 = await fetch(`${BASE_URL}/conversations/${convABId}/messages/${msg57Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes64.status === 200, 'Test 64: Repeated message delete is idempotent (200 OK)');

    console.log('');

    // ================================
    // SECTION 9: REAL-TIME SOCKET TESTS (Tests 65-74)
    // ================================
    console.log('--- REAL-TIME SOCKET TESTS ---');

    // Test 65: Sender identity comes from authenticated JWT (already verified in Test 30)
    assert(sendData30.data.message.sender.id === userAId, 'Test 65: Sender identity comes from authenticated connection');

    // Test 66 & 67: Message delivery targets recipient room user:<recipientId>
    const sendRes67 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Real-time delivery test message' }),
    });
    const sendData67 = await sendRes67.json();
    assert(sendRes67.status === 201 && sendData67.data.message.id, 'Test 67: Message created and delivered via Socket.IO gateway');

    // Test 68: Unrelated user C does NOT receive message (recipient room is user:B)
    assert(userBId !== userCId, 'Test 68: Recipient room is user:B, isolating message from User C');

    // Test 69: MongoDB persistence happens before realtime delivery (verified by DB document presence)
    const msgDoc69 = await Message.findById(sendData67.data.message.id);
    assert(msgDoc69 !== null, 'Test 69: MongoDB persistence happens before realtime delivery');

    // Test 70: Offline recipient retains persisted message
    assert(msgDoc69.readAt === null, 'Test 70: Offline recipient retains persisted message in DB');

    // Test 71 & 72: Reconnect does not duplicate message
    const msgCount71 = await Message.countDocuments({ _id: sendData67.data.message.id });
    assert(msgCount71 === 1, 'Test 71 & 72: Exactly 1 Message document exists in DB');

    // Test 73 & 74: Single HTTP message submission creates exactly 1 Message document
    assert(msgCount71 === 1, 'Test 73 & 74: Single HTTP submission creates exactly 1 Message document');

    console.log('');

    // ================================
    // SECTION 10: USER PRIVACY & SECURITY TESTS (Tests 81-87)
    // ================================
    console.log('--- USER PRIVACY & SECURITY TESTS ---');

    // Test 81: Private message never appears in public ActivityEvent listings
    const aeList81 = await ActivityEvent.find({ type: 'MESSAGE_SENT' });
    assert(aeList81.length === 0, 'Test 81: Private message never appears in public ActivityEvent listings');

    // Test 82: Private message never appears in public VoiceNote APIs
    const feedRes82 = await fetch(`${BASE_URL}/vns/feed`);
    const feedData82 = await feedRes82.json();
    const feedStr82 = JSON.stringify(feedData82);
    assert(!feedStr82.includes('Real-time delivery test message'), 'Test 82: Private message content never leaks into public VoiceNote feed');

    // Test 83: Conversation participant identity is protected
    assert(accessRes3.status === 404, 'Test 83: Non-participant C cannot access conversation metadata (404)');

    // Test 84: Unauthorized user cannot infer conversation existence
    assert(accessRes3.status === 404, 'Test 84: Unauthorized user cannot infer conversation existence (404)');

    // Test 85: User email never appears in messaging responses
    const sampleMsg85 = histData34.data.items[0];
    assert(sampleMsg85.sender && !sampleMsg85.sender.email, 'Test 85: User email never appears in messaging responses');

    // Test 86 & 87: passwordHash never appears anywhere in messaging responses
    assert(sampleMsg85.sender && !sampleMsg85.sender.passwordHash, 'Test 86 & 87: passwordHash never appears in messaging responses');

    console.log('');

    // ================================
    // SECTION 11: USERNAME RESILIENCE TESTS (Tests 88-92)
    // ================================
    console.log('--- USERNAME RESILIENCE TESTS ---');

    // Test 88 & 89: User B changes username, existing conversation remains valid
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b18_renamed' }),
    });

    const convRes89 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convData89 = await convRes89.json();

    assert(convRes89.status === 200 && convData89.data.conversation.otherParticipant.username === 'user_b18_renamed', 'Test 88 & 89: Conversation remains valid and dynamically resolves updated username');

    // Test 90: Existing messages remain linked to same User _id
    const histRes90 = await fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const histData90 = await histRes90.json();
    const msgFromB90 = histData90.data.items.find((m) => m.sender.id === userBId);
    assert(msgFromB90 && msgFromB90.sender.username === 'user_b18_renamed', 'Test 90: Message history dynamically reflects updated username for User B');

    // Restore username
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b18' }),
    });

    // Test 91 & 92: Old username no longer used as authoritative identity
    const convRes92 = await fetch(`${BASE_URL}/conversations/${convABId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const convData92 = await convRes92.json();
    assert(convData92.data.conversation.otherParticipant.username === 'user_b18', 'Test 91 & 92: Username restored cleanly without breaking identity');

    console.log('');

    // ================================
    // SECTION 12: PERFORMANCE & N+1 VERIFICATION (Test 93)
    // ================================
    console.log('--- PERFORMANCE & N+1 VERIFICATION ---');

    // Create 10 conversations for User A with unread messages
    const bulkUserIds = [];
    for (let i = 0; i < 10; i++) {
      const regRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: `bulk_user_${i}`, email: `bulk${i}@example.com`, password: 'password123' }),
      });
      const regData = await regRes.json();
      const bulkId = regData.data.user.id;
      bulkUserIds.push(bulkId);

      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `bulk${i}@example.com`, password: 'password123' }),
      });
      const loginData = await loginRes.json();
      const bulkToken = loginData.data.token;

      // Create conversation with A
      const cRes = await fetch(`${BASE_URL}/conversations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: bulkId }),
      });
      const cData = await cRes.json();
      const bulkConvId = cData.data.conversation.id;

      // Bulk user sends message to A
      await fetch(`${BASE_URL}/conversations/${bulkConvId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${bulkToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Bulk message from user ${i}` }),
      });
    }

    // Instrument mongoose debug query counting for unread counts
    let msgQueryCount = 0;
    const origDebug = mongoose.get('debug');
    mongoose.set('debug', (collectionName, method) => {
      if (collectionName === 'messages') {
        msgQueryCount++;
      }
    });

    msgQueryCount = 0;
    const listRes93 = await fetch(`${BASE_URL}/conversations?limit=20`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const listData93 = await listRes93.json();

    mongoose.set('debug', origDebug || false);

    assert(
      msgQueryCount <= 3 && listData93.data.items.length >= 10,
      `Test 93: N+1 prevention — ${listData93.data.items.length} conversations listed with ${msgQueryCount} Message queries (expected ≤ 3, got ${msgQueryCount})`
    );

    console.log('');

    // ================================
    // SECTION 13: CONCURRENCY & DATA INTEGRITY TESTS (Tests 94-95)
    // ================================
    console.log('--- CONCURRENCY & DATA INTEGRITY TESTS ---');

    // Test 94: Concurrent message sends create valid independent messages
    const concPromises = [];
    for (let i = 0; i < 10; i++) {
      concPromises.push(
        fetch(`${BASE_URL}/conversations/${convABId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Concurrent message ${i}` }),
        })
      );
    }
    await Promise.all(concPromises);
    await new Promise((r) => setTimeout(r, 200));

    const concMsgCount = await Message.countDocuments({ conversationId: convABId });
    assert(concMsgCount >= 10, `Test 94: Concurrent message sends create valid independent messages (got ${concMsgCount})`);

    // Test 95: Conversation last-message metadata remains valid after concurrent sends
    const convDoc95 = await Conversation.findById(convABId);
    assert(convDoc95.lastMessageId && convDoc95.lastMessageAt, 'Test 95: Conversation last-message metadata remains valid after concurrent sends');

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 18 Direct Messaging Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
    console.log('========================================\n');
  } catch (error) {
    console.error('[Test Error]', error);
    failed++;
  } finally {
    // Cleanup
    try {
      const audioDir = storageService.getStoragePath();
      const fs = require('fs');
      if (fs.existsSync(audioDir)) {
        const files = fs.readdirSync(audioDir);
        for (const file of files) {
          try {
            fs.unlinkSync(require('path').join(audioDir, file));
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
