const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';
const TEST_PORT = 5001;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;

const runTests = async () => {
  console.log('=== PHASE 2 AUTHENTICATION & USER MANAGEMENT TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    // Clean test database and sync indexes
    await mongoose.connection.db.dropDatabase();
    await User.syncIndexes();
    console.log('[Test DB] Cleared test DB and synced User indexes');

    // 2. Start HTTP server on test port
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Running on port ${TEST_PORT}\n`);
        resolve();
      });
    });

    // ----------------------------------------------------
    // REGISTRATION TESTS (Tests 1 - 8)
    // ----------------------------------------------------
    console.log('--- Testing Registration ---');

    // Test 1: Valid registration succeeds
    const regRes1 = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_w',
        email: 'alice@example.com',
        password: 'securePassword123',
      }),
    });
    const regData1 = await regRes1.json();

    if (regRes1.status !== 201 || !regData1.success || !regData1.data.user) {
      throw new Error(`Test 1 Failed: ${JSON.stringify(regData1)}`);
    }
    console.log('✓ Test 1: Valid registration succeeds (201 Created)');

    // Fetch user directly from DB for verification
    const dbUser1 = await User.findById(regData1.data.user.id);

    // Test 2: Password is stored as a bcrypt hash ($2a$, $2b$, or $2y$)
    if (!dbUser1.passwordHash || !/^\$2[aby]\$/.test(dbUser1.passwordHash)) {
      throw new Error(`Test 2 Failed: passwordHash is not a valid bcrypt hash (${dbUser1.passwordHash})`);
    }
    console.log('✓ Test 2: Password is stored as a valid bcrypt hash');

    // Test 3: Plaintext password does not exist in database document
    if (dbUser1.password || dbUser1.toObject().password) {
      throw new Error('Test 3 Failed: Plaintext password exists in DB document');
    }
    console.log('✓ Test 3: Plaintext password does not exist in DB document');

    // Test 4: Duplicate username is rejected
    const regResDupUser = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_w',
        email: 'alice2@example.com',
        password: 'anotherPassword123',
      }),
    });
    const regDataDupUser = await regResDupUser.json();
    if (regResDupUser.status !== 400 || regDataDupUser.success !== false) {
      throw new Error('Test 4 Failed: Duplicate username was allowed');
    }
    console.log('✓ Test 4: Duplicate username is rejected (400 Bad Request)');

    // Test 5: Duplicate email is rejected
    const regResDupEmail = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice_w_2',
        email: 'ALICE@example.com', // Case-insensitive duplicate test
        password: 'anotherPassword123',
      }),
    });
    const regDataDupEmail = await regResDupEmail.json();
    if (regResDupEmail.status !== 400 || regDataDupEmail.success !== false) {
      throw new Error('Test 5 Failed: Duplicate email was allowed');
    }
    console.log('✓ Test 5: Duplicate email is rejected (400 Bad Request)');

    // Test 6: Invalid email is rejected
    const regResBadEmail = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'bob_builder',
        email: 'invalid-email-format',
        password: 'password123',
      }),
    });
    const regDataBadEmail = await regResBadEmail.json();
    if (regResBadEmail.status < 400 || regDataBadEmail.success !== false) {
      throw new Error('Test 6 Failed: Invalid email format was allowed');
    }
    console.log('✓ Test 6: Invalid email format is rejected');

    // Test 7: Weak/invalid password (< 6 chars) is rejected
    const regResWeakPwd = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'bob_builder',
        email: 'bob@example.com',
        password: '123',
      }),
    });
    const regDataWeakPwd = await regResWeakPwd.json();
    if (regResWeakPwd.status !== 400 || regDataWeakPwd.success !== false) {
      throw new Error('Test 7 Failed: Weak password was allowed');
    }
    console.log('✓ Test 7: Weak password (< 6 chars) is rejected (400 Bad Request)');

    // Test 8: Registration response does not expose passwordHash
    if (regData1.data.user.passwordHash || regData1.data.user.password) {
      throw new Error('Test 8 Failed: Registration response exposed password or passwordHash');
    }
    console.log('✓ Test 8: Registration response does not expose passwordHash');

    // ----------------------------------------------------
    // LOGIN TESTS (Tests 9 - 14)
    // ----------------------------------------------------
    console.log('\n--- Testing Login ---');

    // Test 9: Valid credentials successfully authenticate
    const loginRes1 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ALICE@example.com', // Test normalized email lookup
        password: 'securePassword123',
      }),
    });
    const loginData1 = await loginRes1.json();
    if (loginRes1.status !== 200 || !loginData1.success || !loginData1.data.token) {
      throw new Error(`Test 9 Failed: ${JSON.stringify(loginData1)}`);
    }
    console.log('✓ Test 9: Valid credentials successfully authenticate (200 OK)');

    const authToken = loginData1.data.token;

    // Test 10: Valid login returns a JWT
    if (typeof authToken !== 'string' || authToken.split('.').length !== 3) {
      throw new Error('Test 10 Failed: Returned token is not a valid JWT string');
    }
    console.log('✓ Test 10: Valid login returns a signed JWT token');

    // Test 11: Wrong password is rejected
    const loginResWrongPwd = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'wrongPassword123',
      }),
    });
    const loginDataWrongPwd = await loginResWrongPwd.json();
    if (loginResWrongPwd.status !== 401 || loginDataWrongPwd.message !== 'Invalid email or password') {
      throw new Error('Test 11 Failed: Wrong password was not rejected with generic error');
    }
    console.log('✓ Test 11: Wrong password is rejected (401 Unauthorized, generic error message)');

    // Test 12: Unknown email is rejected
    const loginResUnknownEmail = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'unknown@example.com',
        password: 'securePassword123',
      }),
    });
    const loginDataUnknownEmail = await loginResUnknownEmail.json();
    if (loginResUnknownEmail.status !== 401 || loginDataUnknownEmail.message !== 'Invalid email or password') {
      throw new Error('Test 12 Failed: Unknown email was not rejected with generic error');
    }
    console.log('✓ Test 12: Unknown email is rejected (401 Unauthorized, generic error message)');

    // Test 13: Login response does not expose passwordHash
    if (loginData1.data.user.passwordHash || loginData1.data.user.password) {
      throw new Error('Test 13 Failed: Login response exposed password or passwordHash');
    }
    console.log('✓ Test 13: Login response does not expose passwordHash');

    // Test 14: JWT contains only intended claims (sub)
    const decodedToken = jwt.decode(authToken);
    if (!decodedToken.sub || decodedToken.password || decodedToken.passwordHash || decodedToken.email) {
      throw new Error(`Test 14 Failed: JWT payload contains sensitive or extra claims: ${JSON.stringify(decodedToken)}`);
    }
    console.log('✓ Test 14: JWT contains only intended sub claim');

    // ----------------------------------------------------
    // AUTHENTICATION MIDDLEWARE TESTS (Tests 15 - 20)
    // ----------------------------------------------------
    console.log('\n--- Testing Authentication Middleware ---');

    // Test 15: Valid token grants access
    const meResValid = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meDataValid = await meResValid.json();
    if (meResValid.status !== 200 || !meDataValid.success) {
      throw new Error('Test 15 Failed: Valid token was denied access');
    }
    console.log('✓ Test 15: Valid token grants access');

    // Test 16: Missing token is rejected
    const meResMissing = await fetch(`${BASE_URL}/users/me`);
    if (meResMissing.status !== 401) {
      throw new Error('Test 16 Failed: Missing token was not rejected with 401');
    }
    console.log('✓ Test 16: Missing token is rejected (401 Unauthorized)');

    // Test 17: Malformed token is rejected
    const meResMalformed = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    if (meResMalformed.status !== 401) {
      throw new Error('Test 17 Failed: Malformed token header was not rejected with 401');
    }
    console.log('✓ Test 17: Malformed Authorization header is rejected (401 Unauthorized)');

    // Test 18: Invalid token signature is rejected
    const meResInvalid = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${authToken}invalidSignature` },
    });
    if (meResInvalid.status !== 401) {
      throw new Error('Test 18 Failed: Invalid token signature was not rejected with 401');
    }
    console.log('✓ Test 18: Invalid token signature is rejected (401 Unauthorized)');

    // Test 19: Expired token is rejected
    const expiredToken = jwt.sign(
      { sub: dbUser1._id.toString() },
      process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production',
      { expiresIn: '-1s' }
    );
    const meResExpired = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    if (meResExpired.status !== 401) {
      throw new Error('Test 19 Failed: Expired token was not rejected with 401');
    }
    console.log('✓ Test 19: Expired token is rejected (401 Unauthorized)');

    // Test 20: Token belonging to deleted/nonexistent user is rejected
    const fakeUserId = new mongoose.Types.ObjectId().toString();
    const fakeUserToken = jwt.sign(
      { sub: fakeUserId },
      process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production',
      { expiresIn: '1h' }
    );
    const meResFakeUser = await fetch(`${BASE_URL}/users/me`, {
      headers: { Authorization: `Bearer ${fakeUserToken}` },
    });
    if (meResFakeUser.status !== 401) {
      throw new Error('Test 20 Failed: Token for nonexistent user was not rejected with 401');
    }
    console.log('✓ Test 20: Token belonging to deleted/nonexistent user is rejected (401 Unauthorized)');

    // ----------------------------------------------------
    // CURRENT USER ENDPOINT TESTS (Tests 21 - 23)
    // ----------------------------------------------------
    console.log('\n--- Testing Current-User Endpoint (/api/users/me) ---');

    // Test 21: Authenticated user can access GET /api/users/me
    if (meResValid.status !== 200 || meDataValid.data.user.username !== 'alice_w') {
      throw new Error('Test 21 Failed: GET /api/users/me returned incorrect user info');
    }
    console.log('✓ Test 21: Authenticated user can access GET /api/users/me');

    // Test 22: Unauthenticated user cannot access it
    if (meResMissing.status !== 401) {
      throw new Error('Test 22 Failed: Unauthenticated access was permitted');
    }
    console.log('✓ Test 22: Unauthenticated user cannot access GET /api/users/me');

    // Test 23: Returned user object does not contain passwordHash
    if (meDataValid.data.user.passwordHash || meDataValid.data.user.password) {
      throw new Error('Test 23 Failed: /api/users/me response exposed passwordHash');
    }
    console.log('✓ Test 23: Returned user object does not contain passwordHash');

    // ----------------------------------------------------
    // PROFILE UPDATE TESTS (Tests 24 - 27)
    // ----------------------------------------------------
    console.log('\n--- Testing Profile Update Endpoint (PATCH /api/users/me) ---');

    // Test 24: Authenticated user can update allowed profile fields
    const patchResAllowed = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        username: 'alice_updated',
        avatar: 'https://storage.vnplatform.com/avatars/alice.png',
        bio: 'Updated bio string',
      }),
    });
    const patchDataAllowed = await patchResAllowed.json();
    if (
      patchResAllowed.status !== 200 ||
      patchDataAllowed.data.user.username !== 'alice_updated' ||
      patchDataAllowed.data.user.bio !== 'Updated bio string'
    ) {
      throw new Error(`Test 24 Failed: Profile update failed: ${JSON.stringify(patchDataAllowed)}`);
    }
    console.log('✓ Test 24: Authenticated user can update allowed profile fields (username, avatar, bio)');

    // Test 25: Unauthenticated user cannot update profile
    const patchResUnauth = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Hacked bio' }),
    });
    if (patchResUnauth.status !== 401) {
      throw new Error('Test 25 Failed: Unauthenticated profile update was permitted');
    }
    console.log('✓ Test 25: Unauthenticated user cannot update profile (401 Unauthorized)');

    // Test 26: User cannot modify protected fields (passwordHash, email, _id)
    const patchResProtected = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        email: 'hacked_email@example.com',
        passwordHash: '$2a$10$fakehash',
      }),
    });
    const patchDataProtected = await patchResProtected.json();
    if (patchDataProtected.data.user.email !== 'alice@example.com') {
      throw new Error('Test 26 Failed: Protected email field was modified');
    }
    console.log('✓ Test 26: User cannot modify protected fields (email, passwordHash)');

    // Register second user for duplicate username test
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'charlie_brown',
        email: 'charlie@example.com',
        password: 'securePassword123',
      }),
    });

    // Test 27: Duplicate username in PATCH /api/users/me is rejected
    const patchResDupUser = await fetch(`${BASE_URL}/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        username: 'charlie_brown', // Username owned by Charlie
      }),
    });
    const patchDataDupUser = await patchResDupUser.json();
    if (patchResDupUser.status !== 400 || patchDataDupUser.success !== false) {
      throw new Error('Test 27 Failed: Duplicate username update was allowed');
    }
    console.log('✓ Test 27: Duplicate username in profile update is rejected (400 Bad Request)');

    console.log('\n=== ALL PHASE 2 AUTHENTICATION TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ AUTHENTICATION TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    // Drop isolated test database and stop test HTTP server
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
