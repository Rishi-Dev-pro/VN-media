const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getMe,
  updateMe,
  getPublicProfile,
  getPublicUserVoiceNotes,
} = require('../controllers/user.controller');

const router = express.Router();

// Authenticated user profile routes (Requires JWT)
router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);

// Public creator profile & voice notes routes (Unauthenticated / Public)
router.get('/:username', getPublicProfile);
router.get('/:username/voice-notes', getPublicUserVoiceNotes);

module.exports = router;
