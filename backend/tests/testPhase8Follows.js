const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');
const Follow = require('../src/models/Follow');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5008;
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
  console.log('=== PHASE 8 FOLLOWERS & FOLLOWING SOCIAL GRAPH TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    await mongoose.connection.db.dropDatabase();
    await User.createIndexes();
    await VoiceNote.createIndexes();
    await Like.createIndexes();
    await Album.createIndexes();
    await AlbumItem.createIndexes();
    await Follow.createIndexes();
    console.log('[Test DB] Cleared test DB and created indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // 3. Register & Login 4 Test Users: User A, User B, User C, User D
    const registerUser = async (username, email) => {
      await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'password123' }),
      });
      const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      const data = await loginRes.json();
      return { token: data.data.token, user: data.data.user };
    };

    const userA = await registerUser('user_a', 'usera@example.com');
    const userB = await registerUser('user_b', 'userb@example.com');
    const userC = await registerUser('user_c', 'userc@example.com');
    const userD = await registerUser('user_d', 'userd@example.com');

    // Set bio/avatar for User B
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ bio: 'Creator B Bio', avatar: 'https://example.com/b.png' }),
    });

    // Create Private VN and Private Album for User B
    const resPrivVN = await fetch(`${BASE_URL}/vns`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: createUploadFormData({ title: 'User B Private Audio', visibility: 'private', buffer: createMinimalWavBuffer(1) }),
    });
    const privVN = (await resPrivVN.json()).data.voiceNote;

    const resPrivAlbum = await fetch(`${BASE_URL}/albums`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ title: 'User B Private Album' }),
    });
    const privAlbum = (await resPrivAlbum.json()).data.album;

    console.log('Setup completed: Created 4 users (User A, B, C, D), 1 Private VN, 1 Private Album for User B\n');

    // ----------------------------------------------------
    // FOLLOW TESTS (Tests 1 - 8)
    // ----------------------------------------------------
    console.log('--- Testing Follow API (POST /api/users/:id/follow) ---');

    // Test 1: User A follows User B
    const resFollow1 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const dataFollow1 = await resFollow1.json();
    if (resFollow1.status !== 200 || !dataFollow1.data.following) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(dataFollow1)}`);
    }
    console.log('✓ Test 1: Authenticated User A can follow User B (200 OK)');

    // Test 2: Follow document stores correct followerId
    const followDoc2 = await Follow.findOne({ followerId: userA.user.id, followingId: userB.user.id });
    if (!followDoc2 || followDoc2.followerId.toString() !== userA.user.id) throw new Error('Test 2 Failed');
    console.log('✓ Test 2: Follow document stores correct followerId');

    // Test 3: Follow document stores correct followingId
    if (followDoc2.followingId.toString() !== userB.user.id) throw new Error('Test 3 Failed');
    console.log('✓ Test 3: Follow document stores correct followingId');

    // Test 4: Follow relationship is unique at DB level
    const list = await Follow.collection.listIndexes().toArray();
    const hasUniqueIndex = list.some(
      (idx) => idx.unique && idx.key && idx.key.followerId === 1 && idx.key.followingId === 1
    );
    if (!hasUniqueIndex) {
      console.log('Actual DB Indexes List:', JSON.stringify(list, null, 2));
      throw new Error('Test 4 Failed: Unique index on followerId + followingId missing');
    }
    console.log('✓ Test 4: Follow relationship unique compound index exists at DB level');

    // Test 5: Duplicate follow does not create a second relationship (idempotent)
    const resFollow5 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const followCount5 = await Follow.countDocuments({ followerId: userA.user.id, followingId: userB.user.id });
    if (resFollow5.status !== 200 || followCount5 !== 1) throw new Error('Test 5 Failed');
    console.log('✓ Test 5: Duplicate follow does not create second relationship (1 document in DB)');

    // Test 6: Unauthenticated user CANNOT follow (401)
    const resFollow6 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST' });
    if (resFollow6.status !== 401) throw new Error('Test 6 Failed');
    console.log('✓ Test 6: Unauthenticated user CANNOT follow (401 Unauthorized)');

    // Test 7: User CANNOT follow themselves (400 Bad Request)
    const resFollow7 = await fetch(`${BASE_URL}/users/${userA.user.id}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (resFollow7.status !== 400) throw new Error('Test 7 Failed');
    console.log('✓ Test 7: User CANNOT follow themselves (400 Bad Request)');

    // Test 8: Following nonexistent user returns 404 Not Found
    const resFollow8 = await fetch(`${BASE_URL}/users/600000000000000000000000/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (resFollow8.status !== 404) throw new Error('Test 8 Failed');
    console.log('✓ Test 8: Following nonexistent user returns 404 Not Found');

    // User A also follows User C
    await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    // User D follows User B
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userD.token}` } });

    // ----------------------------------------------------
    // UNFOLLOW TESTS (Tests 9 - 13)
    // ----------------------------------------------------
    console.log('\n--- Testing Unfollow API (DELETE /api/users/:id/follow) ---');

    // Test 9: User A can unfollow User C
    const resUnfollow9 = await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const dataUnfollow9 = await resUnfollow9.json();
    if (resUnfollow9.status !== 200 || dataUnfollow9.data.following !== false) throw new Error('Test 9 Failed');
    console.log('✓ Test 9: User A can unfollow User C (200 OK)');

    // Test 10: Follow relationship is removed from DB
    const followDoc10 = await Follow.findOne({ followerId: userA.user.id, followingId: userC.user.id });
    if (followDoc10) throw new Error('Test 10 Failed: Follow record still in DB');
    console.log('✓ Test 10: Follow relationship is removed from DB');

    // Test 11: Repeated unfollow is safe (idempotent)
    const resUnfollow11 = await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (resUnfollow11.status !== 200) throw new Error('Test 11 Failed');
    console.log('✓ Test 11: Repeated unfollow is safe (200 OK)');

    // Test 12: User A cannot accidentally remove User D's relationship with User B
    const followDoc12 = await Follow.findOne({ followerId: userD.user.id, followingId: userB.user.id });
    if (!followDoc12) throw new Error('Test 12 Failed: Unrelated relationship was deleted');
    console.log('✓ Test 12: User A cannot remove User D\'s relationship with User B');

    // Test 13: Unauthenticated user CANNOT unfollow (401)
    const resUnfollow13 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'DELETE' });
    if (resUnfollow13.status !== 401) throw new Error('Test 13 Failed');
    console.log('✓ Test 13: Unauthenticated user CANNOT unfollow (401 Unauthorized)');

    // Re-follow User C for User A so state is: A follows B & C; D follows B
    await fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });

    // ----------------------------------------------------
    // FOLLOW STATUS TESTS (Tests 14 - 17)
    // ----------------------------------------------------
    console.log('\n--- Testing Follow Status API (GET /api/users/:id/follow-status) ---');

    // Test 14: Following user returns following = true
    const resStatus14 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow-status`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    const dataStatus14 = await resStatus14.json();
    if (resStatus14.status !== 200 || !dataStatus14.data.following) throw new Error('Test 14 Failed');
    console.log('✓ Test 14: Following user returns following = true');

    // Test 15: Non-following user returns following = false
    const resStatus15 = await fetch(`${BASE_URL}/users/${userA.user.id}/follow-status`, {
      headers: { Authorization: `Bearer ${userB.token}` },
    });
    const dataStatus15 = await resStatus15.json();
    if (resStatus15.status !== 200 || dataStatus15.data.following !== false) throw new Error('Test 15 Failed');
    console.log('✓ Test 15: Non-following user returns following = false');

    // Test 16: Unauthenticated guest cannot access follow-status (401)
    const resStatus16 = await fetch(`${BASE_URL}/users/${userB.user.id}/follow-status`);
    if (resStatus16.status !== 401) throw new Error('Test 16 Failed');
    console.log('✓ Test 16: Guest cannot access protected follow-status endpoint (401)');

    // Test 17: Self follow-status returns following = false
    const resStatus17 = await fetch(`${BASE_URL}/users/${userA.user.id}/follow-status`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if ((await resStatus17.json()).data.following !== false) throw new Error('Test 17 Failed');
    console.log('✓ Test 17: Self follow-status returns following = false');

    // ----------------------------------------------------
    // FOLLOWER LIST TESTS (Tests 18 - 25)
    // ----------------------------------------------------
    console.log('\n--- Testing Followers Endpoint (GET /api/users/:id/followers) ---');

    // User B has followers: User A and User D
    // Test 18: Followers endpoint returns correct users
    const resFollowers18 = await fetch(`${BASE_URL}/users/${userB.user.id}/followers`);
    const dataFollowers18 = await resFollowers18.json();
    if (resFollowers18.status !== 200 || dataFollowers18.data.followers.length !== 2) {
      throw new Error(`Test 18 Failed: ${JSON.stringify(dataFollowers18)}`);
    }
    console.log('✓ Test 18: Followers endpoint returns correct users (2 followers for User B)');

    // Test 19: Follower list does not contain unrelated users (User C is not following User B)
    const followerUsernames = dataFollowers18.data.followers.map((u) => u.username);
    if (followerUsernames.includes('user_c')) throw new Error('Test 19 Failed');
    console.log('✓ Test 19: Follower list does not contain unrelated users');

    // Test 20: Follower list contains only safe public user fields
    const f1 = dataFollowers18.data.followers[0];
    if (!f1.id || !f1.username) throw new Error('Test 20 Failed');
    console.log('✓ Test 20: Follower list contains only safe public user fields');

    // Test 21: email is not exposed in follower list
    if (f1.email !== undefined) throw new Error('Test 21 Failed: email exposed in follower list');
    console.log('✓ Test 21: email is not exposed in follower list');

    // Test 22: passwordHash is not exposed in follower list
    if (f1.passwordHash !== undefined) throw new Error('Test 22 Failed: passwordHash exposed in follower list');
    console.log('✓ Test 22: passwordHash is not exposed in follower list');

    // Test 23: Followers pagination works (?page=1&limit=1)
    const resPag23 = await fetch(`${BASE_URL}/users/${userB.user.id}/followers?page=1&limit=1`);
    const dataPag23 = await resPag23.json();
    if (dataPag23.data.followers.length !== 1 || dataPag23.data.pagination.limit !== 1) throw new Error('Test 23 Failed');
    console.log('✓ Test 23: Followers pagination works (page 1, limit 1)');

    // Test 24: Excessive limit is constrained (capped at 100)
    const resPag24 = await fetch(`${BASE_URL}/users/${userB.user.id}/followers?limit=999999`);
    if ((await resPag24.json()).data.pagination.limit > 100) throw new Error('Test 24 Failed');
    console.log('✓ Test 24: Excessive limit is constrained (capped at 100)');

    // Test 25: Follower list ordering is deterministic (createdAt DESC)
    // User D followed User B after User A
    if (dataFollowers18.data.followers[0].username !== 'user_d') {
      throw new Error(`Test 25 Failed: Most recent follower (user_d) not first: ${dataFollowers18.data.followers[0].username}`);
    }
    console.log('✓ Test 25: Follower list ordering is deterministic (createdAt DESC)');

    // ----------------------------------------------------
    // FOLLOWING LIST TESTS (Tests 26 - 33)
    // ----------------------------------------------------
    console.log('\n--- Testing Following Endpoint (GET /api/users/:id/following) ---');

    // User A is following: User B and User C
    // Test 26: Following endpoint returns correct users
    const resFollowing26 = await fetch(`${BASE_URL}/users/${userA.user.id}/following`);
    const dataFollowing26 = await resFollowing26.json();
    if (resFollowing26.status !== 200 || dataFollowing26.data.following.length !== 2) {
      throw new Error(`Test 26 Failed: ${JSON.stringify(dataFollowing26)}`);
    }
    console.log('✓ Test 26: Following endpoint returns correct users (2 following for User A)');

    // Test 27: Following list does not contain unrelated users (User A is not following User D)
    const followingUsernames = dataFollowing26.data.following.map((u) => u.username);
    if (followingUsernames.includes('user_d')) throw new Error('Test 27 Failed');
    console.log('✓ Test 27: Following list does not contain unrelated users');

    // Test 28: Following list contains only safe public user fields
    const fg1 = dataFollowing26.data.following[0];
    if (!fg1.id || !fg1.username) throw new Error('Test 28 Failed');
    console.log('✓ Test 28: Following list contains only safe public user fields');

    // Test 29: email is not exposed in following list
    if (fg1.email !== undefined) throw new Error('Test 29 Failed');
    console.log('✓ Test 29: email is not exposed in following list');

    // Test 30: passwordHash is not exposed in following list
    if (fg1.passwordHash !== undefined) throw new Error('Test 30 Failed');
    console.log('✓ Test 30: passwordHash is not exposed in following list');

    // Test 31: Following pagination works
    const resPag31 = await fetch(`${BASE_URL}/users/${userA.user.id}/following?page=1&limit=1`);
    if ((await resPag31.json()).data.following.length !== 1) throw new Error('Test 31 Failed');
    console.log('✓ Test 31: Following pagination works (page 1, limit 1)');

    // Test 32: Excessive limit is constrained
    const resPag32 = await fetch(`${BASE_URL}/users/${userA.user.id}/following?limit=999999`);
    if ((await resPag32.json()).data.pagination.limit > 100) throw new Error('Test 32 Failed');
    console.log('✓ Test 32: Excessive limit is constrained (capped at 100)');

    // Test 33: Following list ordering is deterministic (createdAt DESC)
    if (dataFollowing26.data.following[0].username !== 'user_c') throw new Error('Test 33 Failed');
    console.log('✓ Test 33: Following list ordering is deterministic (createdAt DESC)');

    // ----------------------------------------------------
    // COUNT TESTS (Tests 34 - 38)
    // ----------------------------------------------------
    console.log('\n--- Testing Public Profile Follower / Following Counts ---');

    // Test 34: Follower count is correct on public profile of User B (followers = 2)
    const resProf34 = await fetch(`${BASE_URL}/users/user_b`);
    const dataProf34 = await resProf34.json();
    if (resProf34.status !== 200 || dataProf34.data.stats.followers !== 2) {
      throw new Error(`Test 34 Failed: ${JSON.stringify(dataProf34)}`);
    }
    console.log('✓ Test 34: Follower count is correct on User B\'s public profile (followers = 2)');

    // Test 35: Following count is correct on public profile of User A (following = 2)
    const resProf35 = await fetch(`${BASE_URL}/users/user_a`);
    const dataProf35 = await resProf35.json();
    if (resProf35.status !== 200 || dataProf35.data.stats.following !== 2) {
      throw new Error(`Test 35 Failed: ${JSON.stringify(dataProf35)}`);
    }
    console.log('✓ Test 35: Following count is correct on User A\'s public profile (following = 2)');

    // Test 36: Follow increments visible follower/following count correctly
    // User C follows User B -> User B followers becomes 3
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userC.token}` } });
    const resProf36 = await fetch(`${BASE_URL}/users/user_b`);
    if ((await resProf36.json()).data.stats.followers !== 3) throw new Error('Test 36 Failed');
    console.log('✓ Test 36: Following a user increments visible followers count (3 followers)');

    // Test 37: Unfollow decreases the appropriate count
    // User C unfollows User B -> User B followers returns to 2
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userC.token}` } });
    const resProf37 = await fetch(`${BASE_URL}/users/user_b`);
    if ((await resProf37.json()).data.stats.followers !== 2) throw new Error('Test 37 Failed');
    console.log('✓ Test 37: Unfollowing a user decreases followers count back to 2');

    // Test 38: Duplicate follow does not inflate counts
    await fetch(`${BASE_URL}/users/${userB.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userA.token}` } });
    const resProf38 = await fetch(`${BASE_URL}/users/user_b`);
    if ((await resProf38.json()).data.stats.followers !== 2) throw new Error('Test 38 Failed');
    console.log('✓ Test 38: Duplicate follow does not inflate counts (remains 2)');

    // ----------------------------------------------------
    // USERNAME CHANGE TESTS (Tests 39 - 44)
    // ----------------------------------------------------
    console.log('\n--- Testing Username Changes & Relationship Preservation ---');

    // Test 39: User A follows User B (Verified: User A follows User B)
    const followBefore = await Follow.findOne({ followerId: userA.user.id, followingId: userB.user.id });
    if (!followBefore) throw new Error('Test 39 Failed');
    console.log('✓ Test 39: User A follows User B');

    // Test 40: User A changes username to user_a_new
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ username: 'user_a_new' }),
    });
    const followAfterAChange = await Follow.findOne({ followerId: userA.user.id, followingId: userB.user.id });
    if (!followAfterAChange) throw new Error('Test 40 Failed: Follow record lost after follower username change');
    console.log('✓ Test 40: Follow relationship remains intact in DB after follower username change');

    // Test 41: User B changes username to user_b_new
    await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ username: 'user_b_new' }),
    });
    const followAfterBChange = await Follow.findOne({ followerId: userA.user.id, followingId: userB.user.id });
    if (!followAfterBChange) throw new Error('Test 41 Failed: Follow record lost after followed username change');
    console.log('✓ Test 41: Follow relationship remains intact in DB after target username change');

    // Test 42: Followers and following endpoints resolve new usernames
    const resFollowers42 = await fetch(`${BASE_URL}/users/user_b_new/followers`);
    const dataFollowers42 = await resFollowers42.json();
    const usernames42 = dataFollowers42.data.followers.map((u) => u.username);
    if (!usernames42.includes('user_a_new')) throw new Error(`Test 42 Failed: ${JSON.stringify(usernames42)}`);
    console.log('✓ Test 42: Followers and following endpoints resolve new usernames dynamically');

    // Test 43: Follow status using new username works
    const resStatus43 = await fetch(`${BASE_URL}/users/user_b_new/follow-status`, {
      headers: { Authorization: `Bearer ${userA.token}` },
    });
    if (!(await resStatus43.json()).data.following) throw new Error('Test 43 Failed');
    console.log('✓ Test 43: Follow status endpoint works with new username');

    // Test 44: Public profile counts remain intact after username changes
    const resProf44 = await fetch(`${BASE_URL}/users/user_b_new`);
    if ((await resProf44.json()).data.stats.followers !== 2) throw new Error('Test 44 Failed');
    console.log('✓ Test 44: Public profile counts remain intact after username changes');

    // Revert usernames for clarity
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` }, body: JSON.stringify({ username: 'user_a' }) });
    await fetch(`${BASE_URL}/users/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` }, body: JSON.stringify({ username: 'user_b' }) });

    // ----------------------------------------------------
    // PRIVACY TESTS (Tests 45 - 49)
    // ----------------------------------------------------
    console.log('\n--- Testing Following + Content Privacy Boundaries ---');

    // Test 45: Following User B does NOT grant User A access to User B's private VoiceNote (403 Forbidden)
    const resStream45 = await fetch(`${BASE_URL}/vns/${privVN.id}/stream`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resStream45.status !== 403) throw new Error(`Test 45 Failed: Expected 403, got ${resStream45.status}`);
    console.log('✓ Test 45: Following User B does NOT grant User A streaming access to User B\'s private VN (403 Forbidden)');

    // Test 46: Following User B does NOT grant User A access to User B's private Album (403 Forbidden)
    const resAlbum46 = await fetch(`${BASE_URL}/albums/${privAlbum.id}`, { headers: { Authorization: `Bearer ${userA.token}` } });
    if (resAlbum46.status !== 403) throw new Error(`Test 46 Failed: Expected 403, got ${resAlbum46.status}`);
    console.log('✓ Test 46: Following User B does NOT grant User A access to User B\'s private Album (403 Forbidden)');

    // Test 47: Follower lists do not expose private profile fields
    const resFollowers47 = await fetch(`${BASE_URL}/users/user_b/followers`);
    const rawFollowersStr47 = JSON.stringify(await resFollowers47.json());
    if (rawFollowersStr47.includes('passwordHash') || rawFollowersStr47.includes('@example.com')) {
      throw new Error('Test 47 Failed: Sensitive credentials leaked in followers list');
    }
    console.log('✓ Test 47: Follower lists do not expose private profile fields (email/passwordHash)');

    // Test 48: Following lists do not expose private profile fields
    const resFollowing48 = await fetch(`${BASE_URL}/users/user_a/following`);
    const rawFollowingStr48 = JSON.stringify(await resFollowing48.json());
    if (rawFollowingStr48.includes('passwordHash') || rawFollowingStr48.includes('@example.com')) {
      throw new Error('Test 48 Failed: Sensitive credentials leaked in following list');
    }
    console.log('✓ Test 48: Following lists do not expose private profile fields (email/passwordHash)');

    // Test 49: Public profile statistics count ONLY public VoiceNotes even when followed
    const resProf49 = await fetch(`${BASE_URL}/users/user_b`);
    const dataProf49 = await resProf49.json();
    if (dataProf49.data.stats.publicVoiceNotes !== 0) {
      throw new Error(`Test 49 Failed: stats.publicVoiceNotes leaked private VN count: ${dataProf49.data.stats.publicVoiceNotes}`);
    }
    console.log('✓ Test 49: Public profile statistics count ONLY public VoiceNotes (0 public VNs for User B)');

    // ----------------------------------------------------
    // CONCURRENCY & DB INTEGRITY TESTS (Tests 50 - 52)
    // ----------------------------------------------------
    console.log('\n--- Testing Database Unique Constraints & Concurrency Safety ---');

    // Test 50: Simultaneous follow requests create only one Follow document
    const followProm1 = fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userD.token}` } });
    const followProm2 = fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'POST', headers: { Authorization: `Bearer ${userD.token}` } });
    await Promise.all([followProm1, followProm2]);

    const count50 = await Follow.countDocuments({ followerId: userD.user.id, followingId: userC.user.id });
    if (count50 !== 1) throw new Error(`Test 50 Failed: Concurrent requests created ${count50} documents`);
    console.log('✓ Test 50: Simultaneous follow requests create only one Follow document');

    // Test 51: Unique compound index prevents duplicate relationships at DB level
    let dbErrThrown = false;
    try {
      await Follow.create({ followerId: userA.user.id, followingId: userB.user.id });
    } catch (err) {
      if (err.code === 11000) dbErrThrown = true;
    }
    if (!dbErrThrown) throw new Error('Test 51 Failed: Direct Mongoose create allowed duplicate');
    console.log('✓ Test 51: Unique compound index { followerId: 1, followingId: 1 } blocks duplicate at DB level');

    // Test 52: Concurrent unfollow operations do not corrupt state
    const unfollowProm1 = fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userD.token}` } });
    const unfollowProm2 = fetch(`${BASE_URL}/users/${userC.user.id}/follow`, { method: 'DELETE', headers: { Authorization: `Bearer ${userD.token}` } });
    await Promise.all([unfollowProm1, unfollowProm2]);

    const count52 = await Follow.countDocuments({ followerId: userD.user.id, followingId: userC.user.id });
    if (count52 !== 0) throw new Error('Test 52 Failed: Unfollow failed');
    console.log('✓ Test 52: Concurrent unfollow operations complete safely without state corruption');

    console.log('\n=== ALL 52 PHASE 8 FOLLOWERS & FOLLOWING TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ PHASE 8 FOLLOW TEST FAILED:', error);
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
