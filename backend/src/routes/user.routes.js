const express = require('express');
const { protect, protectOptional } = require('../middleware/auth');
const {
  getMe,
  updateMe,
  getPublicProfile,
  getPublicUserVoiceNotes,
} = require('../controllers/user.controller');
const {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
} = require('../controllers/follow.controller');

const router = express.Router();

// Authenticated user profile routes (Requires JWT)
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

// Follow relationship routes (Requires JWT)
router.post('/:id/follow', protect, followUser);
router.delete('/:id/follow', protect, unfollowUser);
router.get('/:id/follow-status', protect, getFollowStatus);

// Public followers and following listings (Unauthenticated / Public)
router.get('/:id/followers', protectOptional, getFollowers);
router.get('/:id/following', protectOptional, getFollowing);

// Public creator profile & voice notes routes (Unauthenticated / Public)
router.get('/:username', protectOptional, getPublicProfile);
router.get('/:username/voice-notes', protectOptional, getPublicUserVoiceNotes);

module.exports = router;
