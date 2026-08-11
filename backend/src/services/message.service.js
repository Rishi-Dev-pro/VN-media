const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const conversationService = require('./conversation.service');
const { getIO } = require('../realtime/socket');

const MAX_MESSAGE_LENGTH = 5000;

class MessageService {
  /**
   * Send a text message inside a 1-to-1 conversation.
   * Updates conversation lastMessageAt and lastMessageId, and emits message:new to recipient socket room.
   */
  async sendMessage({ conversationId, senderUser, content, messageType = 'text' }) {
    if (!senderUser || !senderUser._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId.toString())) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!conversationService.isParticipant(conversation, senderUser._id)) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (messageType !== 'text') {
      const err = new Error(`Unsupported message type: ${messageType}`);
      err.statusCode = 400;
      throw err;
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      const err = new Error('Message content is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
      const err = new Error(`Message content cannot exceed ${MAX_MESSAGE_LENGTH} characters`);
      err.statusCode = 400;
      throw err;
    }

    const message = await Message.create({
      conversationId,
      senderId: senderUser._id,
      content: trimmedContent,
      messageType: 'text',
    });

    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageId = message._id;
    await conversation.save();

    await message.populate('senderId');
    const formattedMessage = conversationService.formatMessage(message);

    // Determine recipient user ID
    const recipientId = conversation.participantOne.toString() === senderUser._id.toString()
      ? conversation.participantTwo.toString()
      : conversation.participantOne.toString();

    // Deliver real-time message payload via Socket.IO gateway strictly to recipient user room
    const io = getIO();
    if (io && recipientId) {
      io.to(`user:${recipientId}`).emit('message:new', formattedMessage);
    }

    return formattedMessage;
  }

  /**
   * Get paginated message history for a conversation.
   */
  async getMessageHistory({ conversationId, currentUserId, page = 1, limit = 50 }) {
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId.toString())) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!conversationService.isParticipant(conversation, currentUserId)) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const p = parseInt(page, 10);
    const parsedPage = isNaN(p) || p < 1 ? 1 : p;

    const l = parseInt(limit, 10);
    const parsedLimit = isNaN(l) || l < 1 ? 50 : Math.min(100, l);

    const filter = { conversationId };

    const total = await Message.countDocuments(filter);
    const totalPages = Math.ceil(total / parsedLimit) || 0;
    const skip = (parsedPage - 1) * parsedLimit;

    const messages = await Message.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('senderId');

    const items = messages.map((msg) => conversationService.formatMessage(msg));

    return {
      items,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Mark incoming unread messages in a conversation as read by the recipient.
   */
  async markMessagesAsRead({ conversationId, currentUserId }) {
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId.toString())) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!conversationService.isParticipant(conversation, currentUserId)) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const userObjectId = new mongoose.Types.ObjectId(currentUserId.toString());

    const result = await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userObjectId },
        readAt: null,
        deletedAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    return {
      updatedCount: result.modifiedCount || 0,
    };
  }

  /**
   * Soft-delete a message owned by the requesting sender.
   */
  async deleteMessage({ conversationId, messageId, currentUserId }) {
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId.toString())) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!conversationService.isParticipant(conversation, currentUserId)) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId.toString())) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    const message = await Message.findOne({ _id: messageId, conversationId });
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    if (message.senderId.toString() !== currentUserId.toString()) {
      const err = new Error('Access denied: You do not have permission to delete this message');
      err.statusCode = 403;
      throw err;
    }

    if (message.deletedAt) {
      return true; // Already soft-deleted (idempotent)
    }

    message.deletedAt = new Date();
    await message.save();

    return true;
  }
}

module.exports = new MessageService();
