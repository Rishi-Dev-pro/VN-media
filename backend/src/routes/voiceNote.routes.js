const express = require('express');
const voiceNoteController = require('../controllers/voiceNote.controller');
const likeRoutes = require('./like.routes');
const { protect, protectOptional } = require('../middleware/auth');
const { uploadSingleAudio } = require('../middleware/upload');

const router = express.Router();

// Public Feed, Search, and Tag Discovery (unauthenticated/optional auth)
router.get('/feed', protectOptional, voiceNoteController.getPublicFeed);
router.get('/search', protectOptional, voiceNoteController.searchVoiceNotes);
router.get('/tags/:tag', protectOptional, voiceNoteController.getVoiceNotesByTag);

// Owner-scoped list (requires auth)
router.get('/me', protect, voiceNoteController.getOwnerVoiceNotes);

// Create VoiceNote (requires auth)
router.post('/', protect, uploadSingleAudio, voiceNoteController.uploadVoiceNote);

// Mount Like endpoints under /:id (e.g. /:id/like, /:id/likes)
router.use('/:id', likeRoutes);

// Single VoiceNote access, metadata update, streaming, and downloads
router.get('/:id', protectOptional, voiceNoteController.getVoiceNoteById);
router.patch('/:id', protect, voiceNoteController.updateVoiceNote);
router.get('/:id/stream', protectOptional, voiceNoteController.streamVoiceNote);
router.get('/:id/download', protectOptional, voiceNoteController.downloadVoiceNote);

// Delete VoiceNote (requires auth)
router.delete('/:id', protect, voiceNoteController.deleteVoiceNote);

module.exports = router;
