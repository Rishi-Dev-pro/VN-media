const express = require('express');
const commentController = require('../controllers/comment.controller');
const { protect, protectOptional } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Comment routes for VoiceNotes
router.post('/', protect, commentController.createComment);
router.get('/', protectOptional, commentController.getComments);
router.delete('/:commentId', protect, commentController.deleteComment);

module.exports = router;
