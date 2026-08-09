const express = require('express');
const voiceNoteController = require('../controllers/voiceNote.controller');
const { protect } = require('../middleware/auth');
const { uploadSingleAudio } = require('../middleware/upload');

const router = express.Router();

// All voice note routes require authentication in Phase 3
router.use(protect);

// Voice note lifecycle endpoints
router.post('/', uploadSingleAudio, voiceNoteController.uploadVoiceNote);
router.get('/me', voiceNoteController.getOwnerVoiceNotes);
router.get('/:id', voiceNoteController.getOwnerVoiceNoteById);
router.delete('/:id', voiceNoteController.deleteVoiceNote);

module.exports = router;
