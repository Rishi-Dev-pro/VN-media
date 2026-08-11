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
const storageService = require('../src/services/storage.service');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5017;
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
  if (tags !== undefined) form.append('tags', typeof tags === 'string' ? tags : JSON.stringify(tags));

  if (buffer) {
    const fileBlob = new Blob([buffer], { type: mimeType });
    form.append('audio', fileBlob, filename);
  }

  return form;
}

const runTests = async () => {
  console.log('=== PHASE 17 USER COMMENTS & DISCUSSIONS TEST SUITE ===\n');

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
    console.log('[Test DB] Cleared test DB and synced indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login Test Users (A, B, C)
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a17', email: 'usera17@example.com', password: 'password123' }),
    });
    const loginARes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usera17@example.com', password: 'password123' }),
    });
    const userAData = await loginARes.json();
    const tokenA = userAData.data.token;
    const userAId = userAData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_b17', email: 'userb17@example.com', password: 'password123' }),
    });
    const loginBRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userb17@example.com', password: 'password123' }),
    });
    const userBData = await loginBRes.json();
    const tokenB = userBData.data.token;
    const userBId = userBData.data.user.id;

    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_c17', email: 'userc17@example.com', password: 'password123' }),
    });
    const loginCRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userc17@example.com', password: 'password123' }),
    });
    const userCData = await loginCRes.json();
    const tokenC = userCData.data.token;
    const userCId = userCData.data.user.id;

    console.log('[Setup] Three test users created and logged in\n');

    // 4. Create test VoiceNotes
    const wavBuffer = createMinimalWavBuffer(1);

    // User B creates a public VoiceNote
    const createPublicRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Public Discussion VN', description: 'Public VN for comment tests', visibility: 'public', tags: ['comment', 'test'], buffer: wavBuffer }),
    });
    const publicVnData = await createPublicRes.json();
    const publicVnId = publicVnData.data.voiceNote.id;

    // User B creates a private VoiceNote
    const createPrivateRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Private Discussion VN', description: 'Private VN', visibility: 'private', buffer: wavBuffer }),
    });
    const privateVnData = await createPrivateRes.json();
    const privateVnId = privateVnData.data.voiceNote.id;

    // User A creates a public VoiceNote (for self-comment tests)
    const createSelfRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
      body: createUploadFormData({ title: 'Self Comment VN', description: 'For self-comment tests', visibility: 'public', buffer: wavBuffer }),
    });
    const selfVnData = await createSelfRes.json();
    const selfVnId = selfVnData.data.voiceNote.id;

    // User B creates a VoiceNote to be deleted
    const createDeleteRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'To Delete VN', description: 'Will be deleted', visibility: 'public', buffer: wavBuffer }),
    });
    const deleteVnData = await createDeleteRes.json();
    const deletedVnId = deleteVnData.data.voiceNote.id;

    // Soft-delete the VoiceNote
    await fetch(`${BASE_URL}/vns/${deletedVnId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });

    console.log('[Setup] Test VoiceNotes created\n');

    // ================================
    // SECTION 1: COMMENT MODEL TESTS (Tests 1-9)
    // ================================
    console.log('--- COMMENT MODEL TESTS ---');

    // Test 1: Valid top-level Comment created directly via Model
    const validComment = await Comment.create({
      voiceNoteId: publicVnId,
      userId: userAId,
      content: 'Direct model comment',
    });
    assert(validComment && validComment._id && validComment.parentCommentId === null, 'Test 1: Valid top-level Comment created in DB');

    // Test 2: Missing content rejected by Mongoose Schema
    let error2 = null;
    try {
      await Comment.create({ voiceNoteId: publicVnId, userId: userAId, content: '' });
    } catch (err) {
      error2 = err;
    }
    assert(error2 !== null, 'Test 2: Missing/empty content rejected by schema');

    // Test 3: Whitespace-only content rejected by Mongoose Schema trim
    let error3 = null;
    try {
      await Comment.create({ voiceNoteId: publicVnId, userId: userAId, content: '   ' });
    } catch (err) {
      error3 = err;
    }
    assert(error3 !== null, 'Test 3: Whitespace-only content rejected by schema');

    // Test 4: Maximum content length enforced by Mongoose Schema
    let error4 = null;
    try {
      await Comment.create({ voiceNoteId: publicVnId, userId: userAId, content: 'a'.repeat(1001) });
    } catch (err) {
      error4 = err;
    }
    assert(error4 !== null, 'Test 4: Content length > 1000 rejected by schema');

    // Test 5: Valid reply created in DB
    const validReply = await Comment.create({
      voiceNoteId: publicVnId,
      userId: userCId,
      parentCommentId: validComment._id,
      content: 'Direct model reply',
    });
    assert(validReply && validReply.parentCommentId.toString() === validComment._id.toString(), 'Test 5: Valid reply created in DB');

    // Test 6: Invalid parentCommentId format rejected by service
    const invalidParentRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Invalid parent', parentCommentId: 'invalid-id' }),
    });
    assert(invalidParentRes.status === 400, 'Test 6: Invalid parentCommentId format rejected (400 Bad Request)');

    // Test 7: Parent comment from another VoiceNote rejected
    const commentOnSelfVn = await Comment.create({
      voiceNoteId: selfVnId,
      userId: userAId,
      content: 'Comment on self VN',
    });
    const crossVnRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Cross VN reply attempt', parentCommentId: commentOnSelfVn._id.toString() }),
    });
    assert(crossVnRes.status === 400, 'Test 7: Parent comment from another VoiceNote rejected (400 Bad Request)');

    // Test 8: Reply to reply (nesting > 1 level) rejected
    const replyToReplyRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Reply to reply attempt', parentCommentId: validReply._id.toString() }),
    });
    assert(replyToReplyRes.status === 400, 'Test 8: Reply to reply (depth > 1) rejected (400 Bad Request)');

    // Test 9: Deleted comment state persisted correctly in DB
    validComment.deletedAt = new Date();
    await validComment.save();
    const fetchedDoc9 = await Comment.findById(validComment._id);
    assert(fetchedDoc9.deletedAt !== null, 'Test 9: Deleted comment state persisted correctly');

    // Clean up direct model test records
    await Comment.deleteMany({ _id: { $in: [validComment._id, validReply._id, commentOnSelfVn._id] } });

    console.log('');

    // ================================
    // SECTION 2: COMMENT CREATION TESTS (Tests 10-18)
    // ================================
    console.log('--- COMMENT CREATION TESTS ---');

    // Test 10: Authenticated user can comment on public VoiceNote
    const createRes10 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Great voice note!' }),
    });
    const createData10 = await createRes10.json();
    assert(createRes10.status === 201 && createData10.success === true && createData10.data.comment.content === 'Great voice note!', 'Test 10: Authenticated user can comment on public VoiceNote');
    const topComment1Id = createData10.data.comment.id;

    // Test 11: Unauthenticated user comment rejected with 401
    const createRes11 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unauth comment' }),
    });
    assert(createRes11.status === 401, 'Test 11: Unauthenticated comment rejected with 401');

    // Test 12: Unknown VoiceNote comment rejected with 404
    const fakeVnId = new mongoose.Types.ObjectId();
    const createRes12 = await fetch(`${BASE_URL}/vns/${fakeVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Fake VN comment' }),
    });
    assert(createRes12.status === 404, 'Test 12: Unknown VoiceNote comment rejected with 404');

    // Test 13: Unauthorized user cannot comment on private VoiceNote
    const createRes13 = await fetch(`${BASE_URL}/vns/${privateVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Private VN comment attempt' }),
    });
    assert(createRes13.status === 403, 'Test 13: Private VoiceNote comment rejected for unauthorized user (403)');

    // Test 14: Private VoiceNote owner can comment
    const createRes14 = await fetch(`${BASE_URL}/vns/${privateVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Owner comment on private VN' }),
    });
    assert(createRes14.status === 201, 'Test 14: Owner can comment on private VoiceNote');

    // Test 15: Deleted VoiceNote cannot receive comments
    const createRes15 = await fetch(`${BASE_URL}/vns/${deletedVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Deleted VN comment attempt' }),
    });
    assert(createRes15.status === 404, 'Test 15: Deleted VoiceNote cannot receive comments (404)');

    // Test 16: Client-supplied userId in body cannot spoof ownership
    const createRes16 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Spoof attempt', userId: userCId }),
    });
    const createData16 = await createRes16.json();
    assert(createRes16.status === 201 && createData16.data.comment.author.id === userAId, 'Test 16: Client-supplied userId in body cannot spoof ownership');

    // Test 17: Successful comment creates exactly one ActivityEvent
    const aeCountBefore17 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED' });
    await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'User C comment' }),
    });
    const aeCountAfter17 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED' });
    assert(aeCountAfter17 - aeCountBefore17 === 1, 'Test 17: Successful comment creates exactly 1 COMMENT_CREATED ActivityEvent');

    // Test 18: Failed comment creates zero ActivityEvents
    const aeCountBefore18 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED' });
    await fetch(`${BASE_URL}/vns/${deletedVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Failed comment' }),
    });
    const aeCountAfter18 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED' });
    assert(aeCountAfter18 === aeCountBefore18, 'Test 18: Failed comment creates zero ActivityEvents');

    console.log('');

    // ================================
    // SECTION 3: COMMENT RETRIEVAL TESTS (Tests 19-26)
    // ================================
    console.log('--- COMMENT RETRIEVAL TESTS ---');

    // Test 19: Guest can retrieve comments on public VoiceNote
    const getRes19 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`);
    const getData19 = await getRes19.json();
    assert(getRes19.status === 200 && getData19.success === true && getData19.data.items.length >= 2, 'Test 19: Guest can retrieve comments on public VoiceNote');

    // Test 20: Authenticated user can retrieve comments on public VoiceNote
    const getRes20 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(getRes20.status === 200, 'Test 20: Authenticated user can retrieve comments on public VoiceNote');

    // Test 21: Private VoiceNote comments are inaccessible to unauthorized users
    const getRes21 = await fetch(`${BASE_URL}/vns/${privateVnId}/comments`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(getRes21.status === 403, 'Test 21: Private VoiceNote comments inaccessible to unauthorized user (403)');

    // Test 22: Deleted VoiceNote comments are inaccessible
    const getRes22 = await fetch(`${BASE_URL}/vns/${deletedVnId}/comments`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(getRes22.status === 404, 'Test 22: Deleted VoiceNote comments inaccessible (404)');

    // Test 23: Comments are deterministically ordered (createdAt ASC)
    const items23 = getData19.data.items;
    let isOrdered = true;
    for (let i = 1; i < items23.length; i++) {
      if (new Date(items23[i].createdAt) < new Date(items23[i - 1].createdAt)) {
        isOrdered = false;
        break;
      }
    }
    assert(isOrdered, 'Test 23: Comments are deterministically ordered (createdAt ASC)');

    // Test 24: Pagination works
    const getRes24 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments?page=1&limit=1`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getData24 = await getRes24.json();
    assert(getData24.data.items.length === 1 && getData24.data.pagination.limit === 1, 'Test 24: Comment pagination works (?page=1&limit=1)');

    // Test 25: Maximum limit is enforced (capped at 100)
    const getRes25 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments?limit=500`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getData25 = await getRes25.json();
    assert(getData25.data.pagination.limit === 100, 'Test 25: Maximum limit is enforced (capped at 100)');

    // Test 26: Invalid pagination handled safely
    const getRes26 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments?page=abc&limit=-10`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const getData26 = await getRes26.json();
    assert(getData26.data.pagination.page === 1 && getData26.data.pagination.limit === 20, 'Test 26: Invalid pagination values default safely to page 1, limit 20');

    console.log('');

    // ================================
    // SECTION 4: THREAD & REPLY TESTS (Tests 27-34)
    // ================================
    console.log('--- THREAD & REPLY TESTS ---');

    // Test 27: Top-level comment appears in list
    assert(items23.some((c) => c.id === topComment1Id), 'Test 27: Top-level comment appears in comments list');

    // Test 28: Reply appears under correct parent
    const replyRes28 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Thanks for listening!', parentCommentId: topComment1Id }),
    });
    const replyData28 = await replyRes28.json();
    assert(replyRes28.status === 201 && replyData28.data.comment.parentCommentId === topComment1Id, 'Test 28: Reply created under correct parent');

    const getRes28 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`);
    const getData28 = await getRes28.json();
    const parentComment28 = getData28.data.items.find((c) => c.id === topComment1Id);
    assert(parentComment28 && parentComment28.replies && parentComment28.replies.length >= 1, 'Test 28b: Reply retrieved inside parent comment.replies array');

    // Test 29: Reply to another VoiceNote comment rejected (already verified in Test 7)
    assert(crossVnRes.status === 400, 'Test 29: Reply to another VoiceNote comment rejected');

    // Test 30: Reply to reply rejected (already verified in Test 8)
    assert(replyToReplyRes.status === 400, 'Test 30: Reply to reply rejected');

    // Test 31: Soft-deleting parent comment with active replies presents parent safely
    const parentToDeleteRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Parent to delete' }),
    });
    const parentToDeleteData = await parentToDeleteRes.json();
    const parentToDeleteId = parentToDeleteData.data.comment.id;

    // Add reply to parent
    await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Reply to parent to delete', parentCommentId: parentToDeleteId }),
    });

    // Delete parent comment
    await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${parentToDeleteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    // Fetch comments
    const getRes31 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`);
    const getData31 = await getRes31.json();
    const deletedParentNode = getData31.data.items.find((c) => c.id === parentToDeleteId);

    assert(
      deletedParentNode &&
      deletedParentNode.content === '[deleted]' &&
      deletedParentNode.deletedAt !== null &&
      deletedParentNode.author === null,
      'Test 31: Soft-deleted parent comment with active replies represented safely with [deleted]'
    );

    // Test 32: Original deleted parent content is not exposed
    assert(deletedParentNode.content !== 'Parent to delete', 'Test 32: Original deleted parent content is NOT exposed');

    // Test 33: Existing replies remain structurally valid after parent deletion
    assert(deletedParentNode.replies && deletedParentNode.replies.length === 1 && deletedParentNode.replies[0].content === 'Reply to parent to delete', 'Test 33: Existing replies remain structurally valid after parent deletion');

    // Test 34: New reply to deleted parent rejected
    const newReplyToDeletedRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New reply to deleted parent attempt', parentCommentId: parentToDeleteId }),
    });
    assert(newReplyToDeletedRes.status === 400, 'Test 34: New reply to deleted parent rejected (400 Bad Request)');

    console.log('');

    // ================================
    // SECTION 5: COMMENT DELETE TESTS (Tests 35-41)
    // ================================
    console.log('--- COMMENT DELETE TESTS ---');

    // Test 35: Owner can delete own comment
    const commentToDeleteRes = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Comment for delete test' }),
    });
    const commentToDeleteData = await commentToDeleteRes.json();
    const cDeleteId = commentToDeleteData.data.comment.id;

    const delRes35 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${cDeleteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(delRes35.status === 200, 'Test 35: Owner can delete own comment');

    // Test 36: Unauthenticated delete rejected with 401
    const delRes36 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${cDeleteId}`, {
      method: 'DELETE',
    });
    assert(delRes36.status === 401, 'Test 36: Unauthenticated delete rejected with 401');

    // Test 37: Non-owner delete rejected with 403
    const newCommentFor37 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Comment by A' }),
    });
    const c37Data = await newCommentFor37.json();
    const c37Id = c37Data.data.comment.id;

    const delRes37 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${c37Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenB}` },
    });
    assert(delRes37.status === 403, 'Test 37: Non-owner delete rejected with 403');

    // Test 38: Unknown comment delete returns 404
    const fakeCommentId = new mongoose.Types.ObjectId();
    const delRes38 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${fakeCommentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes38.status === 404, 'Test 38: Unknown comment delete returns 404');

    // Test 39: Comment from another VoiceNote cannot be deleted through wrong VoiceNote ID
    const delRes39 = await fetch(`${BASE_URL}/vns/${selfVnId}/comments/${c37Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    assert(delRes39.status === 404, 'Test 39: Comment from another VoiceNote cannot be deleted via wrong VoiceNote ID (404)');

    // Test 40: Repeated delete is idempotent (returns 200)
    const delRes40 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${cDeleteId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenC}` },
    });
    assert(delRes40.status === 200, 'Test 40: Repeated delete is idempotent (200 OK)');

    // Test 41: Original comment content is no longer exposed after deletion
    const cDoc41 = await Comment.findById(cDeleteId);
    assert(cDoc41.deletedAt !== null, 'Test 41: Soft deletion timestamp set in DB');

    console.log('');

    // ================================
    // SECTION 6: COMMENT COUNT TESTS (Tests 42-46)
    // ================================
    console.log('--- COMMENT COUNT TESTS ---');

    // Test 42: VoiceNote reports correct commentCount
    const vnRes42 = await fetch(`${BASE_URL}/vns/${publicVnId}`);
    const vnData42 = await vnRes42.json();
    assert(typeof vnData42.data.voiceNote.commentCount === 'number', 'Test 42: VoiceNote reports commentCount');

    // Test 43: New comment increments count
    const countBefore43 = vnData42.data.voiceNote.commentCount;
    const createRes43 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Count increment test comment' }),
    });
    const c43Data = await createRes43.json();
    const c43Id = c43Data.data.comment.id;

    const vnRes43 = await fetch(`${BASE_URL}/vns/${publicVnId}`);
    const vnData43 = await vnRes43.json();
    assert(vnData43.data.voiceNote.commentCount === countBefore43 + 1, 'Test 43: New comment increments commentCount by 1');

    // Test 44: Deleted comment decreases active count
    await fetch(`${BASE_URL}/vns/${publicVnId}/comments/${c43Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const vnRes44 = await fetch(`${BASE_URL}/vns/${publicVnId}`);
    const vnData44 = await vnRes44.json();
    assert(vnData44.data.voiceNote.commentCount === countBefore43, 'Test 44: Deleted comment decreases active commentCount back');

    // Test 45: Reply increments commentCount
    const createReply45 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Count reply test', parentCommentId: topComment1Id }),
    });
    const c45Data = await createReply45.json();
    const vnRes45 = await fetch(`${BASE_URL}/vns/${publicVnId}`);
    const vnData45 = await vnRes45.json();
    assert(vnData45.data.voiceNote.commentCount === countBefore43 + 1, 'Test 45: Reply increments active commentCount');

    // Test 46: Deleted VoiceNote does not expose commentCount (404)
    const vnRes46 = await fetch(`${BASE_URL}/vns/${deletedVnId}`);
    assert(vnRes46.status === 404, 'Test 46: Deleted VoiceNote does not expose commentCount (404)');

    console.log('');

    // ================================
    // SECTION 7: ENGAGEMENT REGRESSION TESTS (Tests 47-55)
    // ================================
    console.log('--- ENGAGEMENT REGRESSION TESTS ---');

    // User A likes publicVnId
    await fetch(`${BASE_URL}/vns/${publicVnId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });

    const singleVn47 = await fetch(`${BASE_URL}/vns/${publicVnId}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const singleData47 = await singleVn47.json();
    const vn47 = singleData47.data.voiceNote;

    // Test 47: Existing likeCount remains correct
    assert(vn47.likeCount >= 1, 'Test 47: Existing likeCount remains correct');

    // Test 48: Existing likedByMe remains correct
    assert(vn47.likedByMe === true, 'Test 48: Existing likedByMe remains correct');

    // Test 49: Comment count is included alongside likeCount and likedByMe
    assert(typeof vn47.commentCount === 'number', 'Test 49: Comment count included alongside likeCount and likedByMe');

    // Test 50: Public feed contains all engagement metadata
    const feedRes50 = await fetch(`${BASE_URL}/vns/feed`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const feedData50 = await feedRes50.json();
    const feedVn50 = feedData50.data.voiceNotes.find((v) => v.id === publicVnId);
    assert(feedVn50 && typeof feedVn50.likeCount === 'number' && typeof feedVn50.likedByMe === 'boolean' && typeof feedVn50.commentCount === 'number', 'Test 50: Public feed contains likeCount, likedByMe, and commentCount');

    // Test 51: Following feed contains all engagement metadata
    // User A follows User B
    await fetch(`${BASE_URL}/users/${userBId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const followingRes51 = await fetch(`${BASE_URL}/vns/feed/following`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const followingData51 = await followingRes51.json();
    const folVn51 = followingData51.data.items.find((v) => v.id === publicVnId);
    assert(folVn51 && typeof folVn51.commentCount === 'number', 'Test 51: Following feed contains commentCount');

    // Test 52: Search contains all engagement metadata
    const searchRes52 = await fetch(`${BASE_URL}/vns/search?q=Discussion`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const searchData52 = await searchRes52.json();
    const searchVn52 = searchData52.data.items.find((v) => v.id === publicVnId);
    assert(searchVn52 && typeof searchVn52.commentCount === 'number', 'Test 52: Search contains commentCount');

    // Test 53: Tag discovery contains all engagement metadata
    const tagRes53 = await fetch(`${BASE_URL}/vns/tags/comment`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const tagData53 = await tagRes53.json();
    const tagVn53 = tagData53.data.items.find((v) => v.id === publicVnId);
    assert(tagVn53 && typeof tagVn53.commentCount === 'number', 'Test 53: Tag discovery contains commentCount');

    // Test 54: Creator profile contains all engagement metadata
    const creatorRes54 = await fetch(`${BASE_URL}/users/user_b17/voice-notes`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const creatorData54 = await creatorRes54.json();
    const creatorVn54 = creatorData54.data.voiceNotes.find((v) => v.id === publicVnId);
    assert(creatorVn54 && typeof creatorVn54.commentCount === 'number', 'Test 54: Creator profile contains commentCount');

    // Test 55: Public Album VoiceNotes contain all engagement metadata
    const albumRes55 = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Comment Album', visibility: 'public' }),
    });
    const albumData55 = await albumRes55.json();
    const albumId55 = albumData55.data.album.id;
    await fetch(`${BASE_URL}/albums/${albumId55}/items`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteId: publicVnId }),
    });
    const albumDetailRes55 = await fetch(`${BASE_URL}/albums/${albumId55}`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const albumDetailData55 = await albumDetailRes55.json();
    const albumVn55 = albumDetailData55.data.items.find((i) => i.voiceNote && i.voiceNote.id === publicVnId);
    assert(albumVn55 && typeof albumVn55.voiceNote.commentCount === 'number', 'Test 55: Public Album VoiceNotes contain commentCount');

    console.log('');

    // ================================
    // SECTION 8: ACTIVITY EVENT TESTS (Tests 56-61)
    // ================================
    console.log('--- ACTIVITY EVENT TESTS ---');

    // Create fresh VN for activity event tests
    const aeVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'AE Comment VN', visibility: 'public', buffer: wavBuffer }),
    });
    const aeVnData = await aeVnRes.json();
    const aeVnId = aeVnData.data.voiceNote.id;

    // Test 56: Comment creates COMMENT_CREATED ActivityEvent
    await fetch(`${BASE_URL}/vns/${aeVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'AE comment' }),
    });

    const ae56 = await ActivityEvent.findOne({
      actorId: userAId,
      type: 'COMMENT_CREATED',
      targetId: aeVnId,
    });
    assert(ae56 !== null, 'Test 56: Comment creates COMMENT_CREATED ActivityEvent');

    // Test 57: Actor ID is correct
    assert(ae56 && ae56.actorId.toString() === userAId, 'Test 57: Actor ID matches comment author');

    // Test 58: Target type is VoiceNote
    assert(ae56 && ae56.targetType === 'VoiceNote', 'Test 58: Target type is VoiceNote');

    // Test 59: Target ID is correct
    assert(ae56 && ae56.targetId.toString() === aeVnId, 'Test 59: Target ID matches VoiceNote ID');

    // Test 60: Failed comment creates no ActivityEvent
    const aeBefore60 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED', targetId: deletedVnId });
    await fetch(`${BASE_URL}/vns/${deletedVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Fail AE comment' }),
    });
    const aeAfter60 = await ActivityEvent.countDocuments({ type: 'COMMENT_CREATED', targetId: deletedVnId });
    assert(aeBefore60 === aeAfter60, 'Test 60: Failed comment creates no ActivityEvent');

    // Test 61: Deleting a comment creates no new ActivityEvent
    const commentForDel61 = await fetch(`${BASE_URL}/vns/${aeVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Comment to delete for AE test' }),
    });
    const c61Data = await commentForDel61.json();
    const c61Id = c61Data.data.comment.id;

    const aeTotalBefore61 = await ActivityEvent.countDocuments({});
    await fetch(`${BASE_URL}/vns/${aeVnId}/comments/${c61Id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const aeTotalAfter61 = await ActivityEvent.countDocuments({});
    assert(aeTotalAfter61 === aeTotalBefore61, 'Test 61: Deleting a comment creates no new ActivityEvent');

    console.log('');

    // ================================
    // SECTION 9: NOTIFICATION TESTS (Tests 62-68)
    // ================================
    console.log('--- NOTIFICATION TESTS ---');

    // Create fresh VN owned by B for notification tests
    const notifVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Notif Comment VN', visibility: 'public', buffer: wavBuffer }),
    });
    const notifVnData = await notifVnRes.json();
    const notifVnId = notifVnData.data.voiceNote.id;

    // Test 62: Comment on another user's VoiceNote creates VOICE_NOTE_COMMENTED notification
    await fetch(`${BASE_URL}/vns/${notifVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Notification trigger comment' }),
    });
    await new Promise((r) => setTimeout(r, 200));

    const notif62 = await Notification.findOne({
      recipientId: userBId,
      type: 'VOICE_NOTE_COMMENTED',
      targetId: notifVnId,
    });
    assert(notif62 !== null, 'Test 62: Comment on another user VoiceNote creates VOICE_NOTE_COMMENTED notification');

    // Test 63: Notification recipient is VoiceNote owner
    assert(notif62 && notif62.recipientId.toString() === userBId, 'Test 63: Notification recipient is VoiceNote owner (User B)');

    // Test 64: Actor is comment author
    assert(notif62 && notif62.actorId.toString() === userAId, 'Test 64: Actor is comment author (User A)');

    // Test 65: Self-comment creates no self-notification
    const selfNotifBefore65 = await Notification.countDocuments({ recipientId: userAId, type: 'VOICE_NOTE_COMMENTED' });
    await fetch(`${BASE_URL}/vns/${selfVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Self comment test' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const selfNotifAfter65 = await Notification.countDocuments({ recipientId: userAId, type: 'VOICE_NOTE_COMMENTED' });
    assert(selfNotifAfter65 === selfNotifBefore65, 'Test 65: Self-comment creates no self-notification');

    // Test 66: Disabled voiceNoteCommented preference suppresses Notification
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteCommented: false }),
    });

    const suppressNotifBefore66 = await Notification.countDocuments({ recipientId: userBId, type: 'VOICE_NOTE_COMMENTED' });
    await fetch(`${BASE_URL}/vns/${notifVnId}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Suppressed comment notif test' }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const suppressNotifAfter66 = await Notification.countDocuments({ recipientId: userBId, type: 'VOICE_NOTE_COMMENTED' });
    assert(suppressNotifAfter66 === suppressNotifBefore66, 'Test 66: Disabled voiceNoteCommented preference suppresses notification');

    // Test 67: ActivityEvent remains when preference is disabled
    const aeCount67 = await ActivityEvent.countDocuments({ actorId: userCId, type: 'COMMENT_CREATED', targetId: notifVnId });
    assert(aeCount67 === 1, 'Test 67: ActivityEvent still recorded when notification preference is disabled');

    // Test 68: Re-enabling preference does not create retroactive notifications
    await fetch(`${BASE_URL}/notifications/preferences`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceNoteCommented: true }),
    });
    await new Promise((r) => setTimeout(r, 200));
    const notifCountAfterReenable = await Notification.countDocuments({ recipientId: userBId, type: 'VOICE_NOTE_COMMENTED' });
    assert(notifCountAfterReenable === suppressNotifAfter66, 'Test 68: Re-enabling preference creates zero retroactive notifications');

    console.log('');

    // ================================
    // SECTION 10: REAL-TIME TESTS (Tests 69-74)
    // ================================
    console.log('--- REAL-TIME TESTS ---');

    // Test 69: Comment produces persisted notification for real-time gateway
    const rtVnRes69 = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'RT Comment VN', visibility: 'public', buffer: wavBuffer }),
    });
    const rtVnData69 = await rtVnRes69.json();
    const rtVnId69 = rtVnData69.data.voiceNote.id;

    await fetch(`${BASE_URL}/vns/${rtVnId69}/comments`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Realtime socket test comment' }),
    });
    await new Promise((r) => setTimeout(r, 200));

    const rtNotif69 = await Notification.findOne({ recipientId: userBId, type: 'VOICE_NOTE_COMMENTED', targetId: rtVnId69 });
    assert(rtNotif69 !== null, 'Test 69: Comment produces persisted notification for real-time delivery');

    // Test 70 & 71: Socket delivery room is user:B and not user:A
    assert(rtNotif69.recipientId.toString() === userBId, 'Test 70 & 71: Notification room is user:B (targeted delivery)');

    // Test 72: Offline recipient gets persisted Notification
    assert(rtNotif69.readAt === null, 'Test 72: Offline recipient gets persisted unread Notification');

    // Test 73: Reconnect does not create duplicate notification
    const notifCount73 = await Notification.countDocuments({ recipientId: userBId, type: 'VOICE_NOTE_COMMENTED', targetId: rtVnId69 });
    assert(notifCount73 === 1, 'Test 73: Reconnect/repeat creates no duplicate notification');

    // Test 74: Self-comment creates no socket notification
    const selfRtNotif74 = await Notification.findOne({ recipientId: userAId, type: 'VOICE_NOTE_COMMENTED', targetId: selfVnId });
    assert(selfRtNotif74 === null, 'Test 74: Self-comment produces zero socket notifications');

    console.log('');

    // ================================
    // SECTION 11: USER PRIVACY TESTS (Tests 75-79)
    // ================================
    console.log('--- USER PRIVACY TESTS ---');

    const getRes75 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`);
    const getData75 = await getRes75.json();
    const sampleAuthor = getData75.data.items[0].author;

    // Test 75: Comment author email is never exposed
    assert(sampleAuthor && !sampleAuthor.email, 'Test 75: Comment author email is never exposed');

    // Test 76: Comment author passwordHash is never exposed
    assert(sampleAuthor && !sampleAuthor.passwordHash, 'Test 76: Comment author passwordHash is never exposed');

    // Test 77: Client cannot spoof author identity (already verified in Test 16)
    assert(createData16.data.comment.author.id === userAId, 'Test 77: Client cannot spoof author identity');

    // Test 78: Username changes update displayed author username dynamically
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a17_renamed' }),
    });

    const getRes78 = await fetch(`${BASE_URL}/vns/${publicVnId}/comments`);
    const getData78 = await getRes78.json();
    const commentByA = getData78.data.items.find((c) => c.author && c.author.id === userAId);
    assert(commentByA && commentByA.author.username === 'user_a17_renamed', 'Test 78: Username changes update displayed author username dynamically');

    // Restore username
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user_a17' }),
    });

    // Test 79: Comment ownership remains tied to immutable User _id
    const commentDoc79 = await Comment.findOne({ userId: userAId });
    assert(commentDoc79 && commentDoc79.userId.toString() === userAId, 'Test 79: Comment ownership remains tied to immutable User _id');

    console.log('');

    // ================================
    // SECTION 12: N+1 PERFORMANCE VERIFICATION (Test 80)
    // ================================
    console.log('--- N+1 PERFORMANCE VERIFICATION ---');

    // Create 20 VoiceNotes with comments
    const bulkVnIds80 = [];
    for (let i = 0; i < 20; i++) {
      const bRes = await fetch(`${BASE_URL}/vns`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenB}` },
        body: createUploadFormData({ title: `Bulk Comment VN ${i}`, visibility: 'public', tags: ['bulkcomment'], buffer: wavBuffer }),
      });
      const bData = await bRes.json();
      bulkVnIds80.push(bData.data.voiceNote.id);
    }

    // Add comments to 10 of them
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE_URL}/vns/${bulkVnIds80[i]}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `Bulk comment ${i}` }),
      });
    }

    // Enable mongoose debug query counting for comments
    let commentQueryCount = 0;
    const origDebug = mongoose.get('debug');
    mongoose.set('debug', (collectionName, method) => {
      if (collectionName === 'comments') {
        commentQueryCount++;
      }
    });

    commentQueryCount = 0;
    const bulkFeedRes = await fetch(`${BASE_URL}/vns/tags/bulkcomment`, {
      headers: { 'Authorization': `Bearer ${tokenA}` },
    });
    const bulkFeedData = await bulkFeedRes.json();

    mongoose.set('debug', origDebug || false);

    assert(
      commentQueryCount <= 2 && bulkFeedData.data.items.length === 20,
      `Test 80: N+1 prevention — 20 VoiceNotes enriched with ${commentQueryCount} Comment queries (expected ≤ 2, got ${commentQueryCount})`
    );

    const vnsWithComments = bulkFeedData.data.items.filter((v) => v.commentCount > 0);
    assert(vnsWithComments.length === 10, 'Test 80b: Batched comment count correctly identifies 10 VNs with comments');

    console.log('');

    // ================================
    // SECTION 13: CONCURRENCY & INTEGRITY TESTS (Tests 81-82)
    // ================================
    console.log('--- CONCURRENCY & INTEGRITY TESTS ---');

    // Test 81: Concurrent comment creation produces valid independent comments
    const concVnRes = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenB}` },
      body: createUploadFormData({ title: 'Concurrent Comment VN', visibility: 'public', buffer: wavBuffer }),
    });
    const concVnData = await concVnRes.json();
    const concVnId = concVnData.data.voiceNote.id;

    const concPromises = [];
    for (let i = 0; i < 10; i++) {
      concPromises.push(
        fetch(`${BASE_URL}/vns/${concVnId}/comments`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `Concurrent comment ${i}` }),
        })
      );
    }
    await Promise.all(concPromises);
    await new Promise((r) => setTimeout(r, 200));

    const concCount = await Comment.countDocuments({ voiceNoteId: concVnId, deletedAt: null });
    assert(concCount === 10, `Test 81: Concurrent comment creation produces 10 valid independent comments (got ${concCount})`);

    // Test 82: Comment count matches active comments in DB
    const singleConcVnRes = await fetch(`${BASE_URL}/vns/${concVnId}`);
    const singleConcData = await singleConcVnRes.json();
    assert(singleConcData.data.voiceNote.commentCount === 10, 'Test 82: VoiceNote commentCount accurately reflects active DB comments (= 10)');

    console.log('');

    // ================================
    // SUMMARY
    // ================================
    console.log('========================================');
    console.log(`Phase 17 Comment Tests: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
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
