const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { sanitizePublicUser } = require('./user.service');

class ConversationService {
  /**
   * Check if a User ID participates in a Conversation.
   *
   * @param {object} conversation - Conversation document or plain object
   * @param {string|object} userId - User ID
   * @returns {boolean}
   */
  isParticipant(conversation, userId) {
    if (!conversation || !userId) return false;

    const uId = userId.toString();
    const p1 = conversation.participantOne
      ? (conversation.participantOne._id || conversation.participantOne).toString()
      : null;
    const p2 = conversation.participantTwo
      ? (conversation.participantTwo._id || conversation.participantTwo).toString()
      : null;

    return p1 === uId || p2 === uId;
  }

  /**
   * Format a Conversation document for a specific requesting user.
   * Exposes sanitized otherParticipant, unreadCount, and lastMessage.
   *
   * @param {object} conversation - Conversation document
   * @param {string|object} currentUserId - Requesting User ID
   * @param {number} [unreadCount=0] - Unread message count
   * @param {object|null} [lastMessage=null] - Formatted last message
   * @returns {object} Formatted conversation payload
   */
  formatConversation(conversation, currentUserId, unreadCount = 0, lastMessage = null) {
    if (!conversation) return null;

    const convObj = typeof conversation.toObject === 'function' ? conversation.toObject() : conversation;
    const uId = currentUserId ? currentUserId.toString() : '';

    let otherParticipantDoc = null;
    const p1Id = convObj.participantOne
      ? (convObj.participantOne._id || convObj.participantOne).toString()
      : null;

    if (p1Id === uId) {
      otherParticipantDoc = convObj.participantTwo;
    } else {
      otherParticipantDoc = convObj.participantOne;
    }

    let sanitizedOther = null;
    if (otherParticipantDoc && typeof otherParticipantDoc === 'object' && otherParticipantDoc.username) {
      sanitizedOther = sanitizePublicUser(otherParticipantDoc);
    }

    return {
      id: convObj._id ? convObj._id.toString() : convObj.id,
      otherParticipant: sanitizedOther,
      lastMessageAt: convObj.lastMessageAt || null,
      lastMessageId: convObj.lastMessageId ? convObj.lastMessageId.toString() : null,
      lastMessage: lastMessage || null,
      unreadCount: unreadCount || 0,
      createdAt: convObj.createdAt,
      updatedAt: convObj.updatedAt,
    };
  }

  /**
   * Format a Message document.
   *
   * @param {object} message - Message document
   * @returns {object} Formatted message payload
   */
  formatMessage(message) {
    if (!message) return null;

    const msgObj = typeof message.toObject === 'function' ? message.toObject() : message;
    const isDeleted = Boolean(msgObj.deletedAt);

    let formattedSender = null;
    if (msgObj.senderId && typeof msgObj.senderId === 'object' && msgObj.senderId.username) {
      formattedSender = sanitizePublicUser(msgObj.senderId);
    } else if (msgObj.sender) {
      formattedSender = msgObj.sender;
    }

    return {
      id: msgObj._id ? msgObj._id.toString() : msgObj.id,
      conversationId: msgObj.conversationId ? msgObj.conversationId.toString() : null,
      content: isDeleted ? '[deleted]' : msgObj.content,
      messageType: msgObj.messageType || 'text',
      readAt: msgObj.readAt || null,
      deletedAt: msgObj.deletedAt || null,
      createdAt: msgObj.createdAt,
      updatedAt: msgObj.updatedAt,
      sender: formattedSender,
    };
  }

  /**
   * Create or retrieve an existing 1-to-1 conversation between current user and target user.
   * Uses deterministic participant pairing and handles race conditions gracefully via DB unique index.
   */
  async createOrGetConversation({ currentUserId, targetUserId }) {
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId.toString())) {
      const err = new Error('Target user not found');
      err.statusCode = 404;
      throw err;
    }

    if (currentUserId.toString() === targetUserId.toString()) {
      const err = new Error('Self conversations are not allowed');
      err.statusCode = 400;
      throw err;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      const err = new Error('Target user not found');
      err.statusCode = 404;
      throw err;
    }

    const pair = Conversation.getParticipantPair(currentUserId, targetUserId);

    let conversation = await Conversation.findOne(pair).populate('participantOne participantTwo');

    if (!conversation) {
      try {
        conversation = await Conversation.create(pair);
        conversation = await Conversation.findById(conversation._id).populate('participantOne participantTwo');
      } catch (err) {
        if (err.code === 11000) {
          // Handle concurrent creation duplicate key error gracefully
          conversation = await Conversation.findOne(pair).populate('participantOne participantTwo');
        } else {
          throw err;
        }
      }
    }

    // Get unread count for current user
    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      senderId: { $ne: currentUserId },
      readAt: null,
      deletedAt: null,
    });

    let lastMessage = null;
    if (conversation.lastMessageId) {
      const lastMsgDoc = await Message.findById(conversation.lastMessageId).populate('senderId');
      if (lastMsgDoc) {
        lastMessage = this.formatMessage(lastMsgDoc);
      }
    }

    return this.formatConversation(conversation, currentUserId, unreadCount, lastMessage);
  }

  /**
   * Get paginated conversations for current user with batched unread counts and last message details.
   */
  async getUserConversations({ currentUserId, page = 1, limit = 20 }) {
    if (!currentUserId || !mongoose.Types.ObjectId.isValid(currentUserId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const p = parseInt(page, 10);
    const parsedPage = isNaN(p) || p < 1 ? 1 : p;

    const l = parseInt(limit, 10);
    const parsedLimit = isNaN(l) || l < 1 ? 20 : Math.min(100, l);

    const userObjectId = new mongoose.Types.ObjectId(currentUserId.toString());
    const filter = {
      $or: [{ participantOne: userObjectId }, { participantTwo: userObjectId }],
    };

    const total = await Conversation.countDocuments(filter);
    const totalPages = Math.ceil(total / parsedLimit) || 0;
    const skip = (parsedPage - 1) * parsedLimit;

    const conversations = await Conversation.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .populate('participantOne participantTwo');

    if (conversations.length === 0) {
      return {
        items: [],
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total,
          totalPages,
        },
      };
    }

    const convObjectIds = conversations.map((c) => c._id);

    // Batched query 1: Unread message counts grouped by conversationId (1 aggregate query)
    const unreadResults = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: convObjectIds },
          senderId: { $ne: userObjectId },
          readAt: null,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: '$conversationId',
          count: { $sum: 1 },
        },
      },
    ]);

    const unreadMap = {};
    for (const res of unreadResults) {
      unreadMap[res._id.toString()] = res.count;
    }

    // Batched query 2: Last message docs for returned conversations (1 query)
    const lastMsgObjectIds = conversations
      .map((c) => c.lastMessageId)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id.toString()));

    let lastMsgMap = {};
    if (lastMsgObjectIds.length > 0) {
      const lastMsgDocs = await Message.find({ _id: { $in: lastMsgObjectIds } }).populate('senderId');
      for (const msg of lastMsgDocs) {
        lastMsgMap[msg._id.toString()] = this.formatMessage(msg);
      }
    }

    const items = conversations.map((conv) => {
      const convIdStr = conv._id.toString();
      const unreadCount = unreadMap[convIdStr] || 0;
      const lastMsg = conv.lastMessageId ? lastMsgMap[conv.lastMessageId.toString()] : null;
      return this.formatConversation(conv, currentUserId, unreadCount, lastMsg);
    });

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
   * Get single conversation details by ID for authenticated participant.
   */
  async getConversationById({ conversationId, currentUserId }) {
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

    const conversation = await Conversation.findById(conversationId).populate('participantOne participantTwo');
    if (!conversation) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    if (!this.isParticipant(conversation, currentUserId)) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    const unreadCount = await Message.countDocuments({
      conversationId: conversation._id,
      senderId: { $ne: currentUserId },
      readAt: null,
      deletedAt: null,
    });

    let lastMessage = null;
    if (conversation.lastMessageId) {
      const lastMsgDoc = await Message.findById(conversation.lastMessageId).populate('senderId');
      if (lastMsgDoc) {
        lastMessage = this.formatMessage(lastMsgDoc);
      }
    }

    return this.formatConversation(conversation, currentUserId, unreadCount, lastMessage);
  }
}

module.exports = new ConversationService();
