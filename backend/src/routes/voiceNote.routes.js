const express = require('express');
const voiceNoteController = require('../controllers/voiceNote.controller');
const likeRoutes = require('./like.routes');
const { protect, protectOptional } = require('../middleware/auth');
const { uploadSingleAudio } = require('../middleware/upload');

const router = express.Router();

// Public Feed (unauthenticated/optional auth)
router.get('/feed', protectOptional, voiceNoteController.getPublicFeed);

// Owner-scoped list (requires auth)
router.get('/me', protect, voiceNoteController.getOwnerVoiceNotes);

// Create VoiceNote (requires auth)
router.post('/', protect, uploadSingleAudio, voiceNoteController.uploadVoiceNote);

// Mount Like endpoints under /:id (e.g. /:id/like, /:id/likes)
router.use('/:id', likeRoutes);

// Single VoiceNote access, streaming, and downloads (optional auth for public/private authorization)
router.get('/:id', protectOptional, voiceNoteController.getVoiceNoteById);
router.get('/:id/stream', protectOptional, voiceNoteController.streamVoiceNote);
router.get('/:id/download', protectOptional, voiceNoteController.downloadVoiceNote);

// Delete VoiceNote (requires auth)
router.delete('/:id', protect, voiceNoteController.deleteVoiceNote);

module.exports = router;
