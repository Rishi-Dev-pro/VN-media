const express = require('express');
const likeController = require('../controllers/like.controller');
const { protect, protectOptional } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Like endpoints for VoiceNote
router.post('/like', protect, likeController.likeVoiceNote);
router.delete('/like', protect, likeController.unlikeVoiceNote);
router.get('/likes', protectOptional, getVoiceNoteLikesHandler);

function getVoiceNoteLikesHandler(req, res, next) {
  return likeController.getVoiceNoteLikes(req, res, next);
}

module.exports = router;
