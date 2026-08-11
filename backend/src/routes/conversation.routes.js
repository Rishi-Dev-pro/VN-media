const express = require('express');
const conversationController = require('../controllers/conversation.controller');
const { protect } = require('../middleware/auth');
const { uploadSingleAudio } = require('../middleware/upload');

const router = express.Router();

// All conversation & direct messaging endpoints require authentication
router.use(protect);

// Conversation endpoints
router.post('/', conversationController.createConversation);
router.get('/', conversationController.getConversations);
router.get('/:id', conversationController.getConversationById);

// Message endpoints
router.post('/:id/messages', conversationController.sendMessage);
router.post('/:id/messages/audio', uploadSingleAudio, conversationController.sendAudioMessage);
router.get('/:id/messages', conversationController.getMessageHistory);
router.patch('/:id/read', conversationController.markRead);
router.delete('/:id/messages/:messageId', conversationController.deleteMessage);

module.exports = router;
