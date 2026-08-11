const conversationService = require('../services/conversation.service');
const messageService = require('../services/message.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create or get an existing 1-to-1 conversation with a target user.
 * POST /api/conversations
 */
const createConversation = async (req, res, next) => {
  try {
    const conversation = await conversationService.createOrGetConversation({
      currentUserId: req.user._id,
      targetUserId: req.body?.userId,
    });

    return sendSuccess(res, 'Conversation retrieved successfully', { conversation }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated list of conversations for authenticated user.
 * GET /api/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const { items, pagination } = await conversationService.getUserConversations({
      currentUserId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Conversations retrieved successfully', {
      items,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single conversation by ID for authenticated participant.
 * GET /api/conversations/:id
 */
const getConversationById = async (req, res, next) => {
  try {
    const conversation = await conversationService.getConversationById({
      conversationId: req.params.id,
      currentUserId: req.user._id,
    });

    return sendSuccess(res, 'Conversation retrieved successfully', { conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * Send a text message inside a conversation.
 * POST /api/conversations/:id/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const message = await messageService.sendMessage({
      conversationId: req.params.id,
      senderUser: req.user,
      content: req.body?.content,
      messageType: req.body?.messageType || 'text',
    });

    return sendSuccess(res, 'Message sent successfully', { message }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated message history for a conversation.
 * GET /api/conversations/:id/messages
 */
const getMessageHistory = async (req, res, next) => {
  try {
    const { items, pagination } = await messageService.getMessageHistory({
      conversationId: req.params.id,
      currentUserId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Message history retrieved successfully', {
      items,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark incoming unread messages as read by recipient.
 * PATCH /api/conversations/:id/read
 */
const markRead = async (req, res, next) => {
  try {
    const result = await messageService.markMessagesAsRead({
      conversationId: req.params.id,
      currentUserId: req.user._id,
    });

    return sendSuccess(res, 'Messages marked as read successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Soft-delete a message owned by sender.
 * DELETE /api/conversations/:conversationId/messages/:messageId
 */
const deleteMessage = async (req, res, next) => {
  try {
    await messageService.deleteMessage({
      conversationId: req.params.conversationId || req.params.id,
      messageId: req.params.messageId,
      currentUserId: req.user._id,
    });

    return sendSuccess(res, 'Message deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Upload and send an audio message inside a conversation.
 * POST /api/conversations/:id/messages/audio
 */
const sendAudioMessage = async (req, res, next) => {
  try {
    const message = await messageService.sendAudioMessage({
      conversationId: req.params.id,
      senderUser: req.user,
      file: req.file,
    });

    return sendSuccess(res, 'Audio message sent successfully', { message }, 201);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  sendMessage,
  sendAudioMessage,
  getMessageHistory,
  markRead,
  deleteMessage,
};
