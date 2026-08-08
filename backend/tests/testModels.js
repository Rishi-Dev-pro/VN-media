const mongoose = require('mongoose');
const User = require('../src/models/User');
const VoiceNote = require('../src/models/VoiceNote');
const Like = require('../src/models/Like');
const Album = require('../src/models/Album');
const AlbumItem = require('../src/models/AlbumItem');

const TEST_DB_URI = 'mongodb://localhost:27017/vn_platform_test';

const runTests = async () => {
  console.log('=== PHASE 1 DATABASE MODEL TEST SUITE ===\n');

  try {
    // 1. Connect to isolated test database
    await mongoose.connect(TEST_DB_URI);
    console.log('[Test DB] Connected to isolated test database: vn_platform_test');

    // Clean any prior leftover test data
    await mongoose.connection.db.dropDatabase();
    console.log('[Test DB] Initial database clean completed');

    // Ensure all model indexes are built/synced
    await User.syncIndexes();
    await VoiceNote.syncIndexes();
    await Like.syncIndexes();
    await Album.syncIndexes();
    await AlbumItem.syncIndexes();
    console.log('[Test DB] All model indexes synced\n');

    // ----------------------------------------------------
    // USER MODEL TESTS
    // ----------------------------------------------------
    console.log('--- Testing User Model ---');

    // User Test 1: Valid User Creation
    const validUser = await User.create({
      username: 'john_doe',
      email: 'john@example.com',
      passwordHash: '$2a$10$hashedpasswordstringplaceholder',
      bio: 'Hello world! Voice note enthusiast.',
    });
    console.log('✓ Valid User created:', validUser.username, `(${validUser._id})`);

    // User Test 2: Missing Required Fields Rejection
    let userErrHandled = false;
    try {
      await User.create({ username: 'incomplete_user' });
    } catch (err) {
      userErrHandled = true;
      console.log('✓ Rejection of missing required fields (email, passwordHash) verified');
    }
    if (!userErrHandled) throw new Error('Failed: Incomplete User was unexpectedly created');

    // User Test 3: Duplicate Username Rejection
    let dupUserHandled = false;
    try {
      await User.create({
        username: 'john_doe',
        email: 'john2@example.com',
        passwordHash: '$2a$10$anotherhashedpassword',
      });
    } catch (err) {
      if (err.code === 11000) {
        dupUserHandled = true;
        console.log('✓ Duplicate username rejection verified (E11000)');
      }
    }
    if (!dupUserHandled) throw new Error('Failed: Duplicate username was unexpectedly allowed');

    // User Test 4: Duplicate Email Rejection
    let dupEmailHandled = false;
    try {
      await User.create({
        username: 'john_doe_2',
        email: 'john@example.com',
        passwordHash: '$2a$10$anotherhashedpassword',
      });
    } catch (err) {
      if (err.code === 11000) {
        dupEmailHandled = true;
        console.log('✓ Duplicate email rejection verified (E11000)');
      }
    }
    if (!dupEmailHandled) throw new Error('Failed: Duplicate email was unexpectedly allowed');

    // Create a second valid user for multi-user tests
    const secondUser = await User.create({
      username: 'jane_smith',
      email: 'jane@example.com',
      passwordHash: '$2a$10$hashedpasswordstringplaceholder',
    });

    console.log('\n--- Testing VoiceNote Model ---');

    // VoiceNote Test 1: Valid VoiceNote Creation
    const validVN = await VoiceNote.create({
      ownerId: validUser._id,
      title: 'Morning Motivation',
      description: 'Daily thoughts on product building.',
      audioUrl: 'https://storage.vnplatform.com/audio/vn_101.mp3',
      duration: 145.5,
      visibility: 'public',
    });
    console.log('✓ Valid VoiceNote created:', validVN.title, `(${validVN._id}) referencing owner: ${validVN.ownerId}`);

    // VoiceNote Test 2: Invalid Visibility Rejection
    let invalidVisHandled = false;
    try {
      await VoiceNote.create({
        ownerId: validUser._id,
        title: 'Secret VN',
        audioUrl: 'https://storage.vnplatform.com/audio/vn_102.mp3',
        duration: 30,
        visibility: 'friends_only', // Invalid enum value
      });
    } catch (err) {
      invalidVisHandled = true;
      console.log('✓ Invalid visibility value ("friends_only") correctly rejected');
    }
    if (!invalidVisHandled) throw new Error('Failed: Invalid visibility value was allowed');

    // VoiceNote Test 3: Missing Required Fields Rejection
    let missingVNFieldsHandled = false;
    try {
      await VoiceNote.create({
        ownerId: validUser._id,
        title: 'Incomplete VN',
        // Missing audioUrl and duration
      });
    } catch (err) {
      missingVNFieldsHandled = true;
      console.log('✓ Missing required VoiceNote fields (audioUrl, duration) correctly rejected');
    }
    if (!missingVNFieldsHandled) throw new Error('Failed: Incomplete VoiceNote was allowed');

    console.log('\n--- Testing Like Model ---');

    // Like Test 1: Valid Like Creation
    const validLike = await Like.create({
      userId: secondUser._id,
      voiceNoteId: validVN._id,
    });
    console.log('✓ Valid Like created: User', validLike.userId, 'liked VoiceNote', validLike.voiceNoteId);

    // Like Test 2: Duplicate Compound Unique Index Rejection (userId + voiceNoteId)
    let dupLikeHandled = false;
    try {
      await Like.create({
        userId: secondUser._id,
        voiceNoteId: validVN._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        dupLikeHandled = true;
        console.log('✓ Duplicate Like rejection verified (userId + voiceNoteId compound unique index)');
      }
    }
    if (!dupLikeHandled) throw new Error('Failed: Duplicate like was unexpectedly allowed');

    console.log('\n--- Testing Album Model ---');

    // Album Test 1: Valid Album Creation
    const validAlbum = await Album.create({
      ownerId: validUser._id,
      title: 'College Podcast Clips',
      description: 'A collection of short voice notes.',
      coverImage: 'https://storage.vnplatform.com/images/album_cover_1.jpg',
    });
    console.log('✓ Valid Album created:', validAlbum.title, `(${validAlbum._id}) referencing owner: ${validAlbum.ownerId}`);

    console.log('\n--- Testing AlbumItem Model ---');

    // AlbumItem Test 1: Valid AlbumItem Creation with Position
    const validAlbumItem = await AlbumItem.create({
      albumId: validAlbum._id,
      voiceNoteId: validVN._id,
      position: 1,
    });
    console.log('✓ Valid AlbumItem created: Album', validAlbumItem.albumId, 'contains VoiceNote', validAlbumItem.voiceNoteId, 'at position:', validAlbumItem.position);

    // AlbumItem Test 2: Duplicate VoiceNote in Same Album Rejection
    let dupAlbumItemHandled = false;
    try {
      await AlbumItem.create({
        albumId: validAlbum._id,
        voiceNoteId: validVN._id,
        position: 2,
      });
    } catch (err) {
      if (err.code === 11000) {
        dupAlbumItemHandled = true;
        console.log('✓ Duplicate VoiceNote in same Album rejected (albumId + voiceNoteId compound unique index)');
      }
    }
    if (!dupAlbumItemHandled) throw new Error('Failed: Duplicate AlbumItem was allowed');

    // AlbumItem Test 3: Duplicate Position in Same Album Rejection
    const secondVN = await VoiceNote.create({
      ownerId: validUser._id,
      title: 'Evening Reflection',
      audioUrl: 'https://storage.vnplatform.com/audio/vn_103.mp3',
      duration: 60,
      visibility: 'private',
    });

    let dupPosHandled = false;
    try {
      await AlbumItem.create({
        albumId: validAlbum._id,
        voiceNoteId: secondVN._id,
        position: 1, // Position 1 already used by validVN
      });
    } catch (err) {
      if (err.code === 11000) {
        dupPosHandled = true;
        console.log('✓ Duplicate position in same Album rejected (albumId + position compound unique index)');
      }
    }
    if (!dupPosHandled) throw new Error('Failed: Duplicate position in Album was allowed');

    // Create valid second AlbumItem with position 2
    const secondAlbumItem = await AlbumItem.create({
      albumId: validAlbum._id,
      voiceNoteId: secondVN._id,
      position: 2,
    });
    console.log('✓ Valid second AlbumItem created at position:', secondAlbumItem.position);

    console.log('\n=== ALL PHASE 1 DATABASE MODEL TESTS PASSED SUCCESSFULLY ===');
  } catch (error) {
    console.error('\n❌ DATABASE TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    // 4. Drop test database and close connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      console.log('\n[Test DB] Isolated test database dropped cleanly');
      await mongoose.connection.close();
      console.log('[Test DB] Connection closed');
    }
  }
};

runTests();
