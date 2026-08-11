const conversationService = require('../services/conversation.service');
const messageService = require('../services/message.service');
const storageService = require('../services/storage.service');
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

/**
 * Stream private audio message with HTTP Range support (200 OK, 206 Partial Content, 416 Range Not Satisfiable).
 * GET /api/conversations/:id/messages/:messageId/audio
 */
const streamAudioMessage = async (req, res, next) => {
  try {
    const { fileSize, mimeType, audioUrl } = await messageService.getAudioMessageStreamInfo({
      conversationId: req.params.conversationId || req.params.id,
      messageId: req.params.messageId,
      currentUserId: req.user._id,
    });

    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

    const range = req.headers.range;

    if (!range) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(200);
      return storageService.createReadStream(audioUrl).pipe(res);
    }

    if (!range.startsWith('bytes=')) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
    }

    const rangeSpec = range.slice(6).trim();

    // Suffix range `bytes=-N` (e.g. `bytes=-500`)
    if (rangeSpec.startsWith('-')) {
      const suffixStr = rangeSpec.slice(1);
      const suffix = parseInt(suffixStr, 10);
      if (isNaN(suffix) || suffix <= 0) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
      }

      const start = Math.max(0, fileSize - suffix);
      const end = fileSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', mimeType);
      return storageService.createReadStream(audioUrl, { start, end }).pipe(res);
    }

    // Standard range `bytes=start-end` or `bytes=start-`
    const parts = rangeSpec.split('-');
    if (parts.length !== 2) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
    }

    const startStr = parts[0];
    const endStr = parts[1];

    if (startStr === '') {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
    }

    const start = parseInt(startStr, 10);
    let end = endStr !== '' ? parseInt(endStr, 10) : fileSize - 1;

    if (
      isNaN(start) ||
      isNaN(end) ||
      start < 0 ||
      start >= fileSize ||
      start > end
    ) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
    }

    if (end >= fileSize) {
      end = fileSize - 1;
    }

    const chunkSize = end - start + 1;

    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', chunkSize);
    res.setHeader('Content-Type', mimeType);

    return storageService.createReadStream(audioUrl, { start, end }).pipe(res);
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
  streamAudioMessage,
  getMessageHistory,
  markRead,
  deleteMessage,
};
