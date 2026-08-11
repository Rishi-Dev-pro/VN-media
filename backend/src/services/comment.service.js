const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const VoiceNote = require('../models/VoiceNote');
const voiceNoteService = require('./voiceNote.service');
const { sanitizePublicUser } = require('./user.service');

const MAX_COMMENT_LENGTH = 1000;

class CommentService {
  /**
   * Format a Comment document for client responses.
   *
   * @param {object} comment - Mongoose Comment document or plain object
   * @returns {object} Formatted comment payload with sanitized author
   */
  formatComment(comment) {
    if (!comment) return null;

    const commentObj = typeof comment.toObject === 'function' ? comment.toObject() : comment;

    const isDeleted = Boolean(commentObj.deletedAt);

    let formattedAuthor = null;
    if (!isDeleted) {
      if (commentObj.userId && typeof commentObj.userId === 'object' && commentObj.userId.username) {
        formattedAuthor = sanitizePublicUser(commentObj.userId);
      } else if (commentObj.author) {
        formattedAuthor = commentObj.author;
      }
    }

    return {
      id: commentObj._id ? commentObj._id.toString() : commentObj.id,
      content: isDeleted ? '[deleted]' : commentObj.content,
      parentCommentId: commentObj.parentCommentId
        ? commentObj.parentCommentId.toString()
        : null,
      createdAt: commentObj.createdAt,
      updatedAt: commentObj.updatedAt,
      deletedAt: commentObj.deletedAt || null,
      author: formattedAuthor,
    };
  }

  /**
   * Create a top-level comment or reply to an existing comment.
   * Enforces VoiceNote accessibility, content validation, and 1-level thread nesting limit.
   */
  async createComment({ voiceNoteId, user, content, parentCommentId = null }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!voiceNoteId || !mongoose.Types.ObjectId.isValid(voiceNoteId.toString())) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote || voiceNote.deletedAt) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const access = voiceNoteService.canAccessVoiceNote(user, voiceNote);
    if (!access.allowed) {
      const err = new Error(access.message);
      err.statusCode = access.statusCode;
      throw err;
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      const err = new Error('Comment content is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length > MAX_COMMENT_LENGTH) {
      const err = new Error(`Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters`);
      err.statusCode = 400;
      throw err;
    }

    let parentId = null;
    if (parentCommentId !== null && parentCommentId !== undefined && parentCommentId !== '') {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId.toString())) {
        const err = new Error('Parent comment not found');
        err.statusCode = 400;
        throw err;
      }

      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment || parentComment.deletedAt) {
        const err = new Error('Parent comment not found or deleted');
        err.statusCode = 400;
        throw err;
      }

      if (parentComment.voiceNoteId.toString() !== voiceNoteId.toString()) {
        const err = new Error('Parent comment belongs to a different voice note');
        err.statusCode = 400;
        throw err;
      }

      // Enforce max 1-level reply nesting limit
      if (parentComment.parentCommentId !== null) {
        const err = new Error('Nested replies are not allowed. Replies can only be created for top-level comments.');
        err.statusCode = 400;
        throw err;
      }

      parentId = parentComment._id;
    }

    const comment = await Comment.create({
      voiceNoteId,
      userId: user._id,
      parentCommentId: parentId,
      content: trimmedContent,
    });

    // Populate user details for formatted response
    await comment.populate('userId');

    // Record COMMENT_CREATED ActivityEvent
    const activityEventService = require('./activityEvent.service');
    const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
    await activityEventService.createActivityEvent({
      actorId: user._id,
      type: EVENT_TYPES.COMMENT_CREATED,
      targetType: TARGET_TYPES.VOICE_NOTE,
      targetId: voiceNoteId,
    });

    return this.formatComment(comment);
  }

  /**
   * Get paginated comments and replies for a VoiceNote.
   */
  async getCommentsForVoiceNote({ voiceNoteId, user, page = 1, limit = 20 }) {
    if (!voiceNoteId || !mongoose.Types.ObjectId.isValid(voiceNoteId.toString())) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote || voiceNote.deletedAt) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const access = voiceNoteService.canAccessVoiceNote(user, voiceNote);
    if (!access.allowed) {
      const err = new Error(access.message);
      err.statusCode = access.statusCode;
      throw err;
    }

    const p = parseInt(page, 10);
    const parsedPage = isNaN(p) || p < 1 ? 1 : p;

    const l = parseInt(limit, 10);
    const parsedLimit = isNaN(l) || l < 1 ? 20 : Math.min(100, l);

    // 1. Query all top-level comments for this VoiceNote
    const topLevelComments = await Comment.find({
      voiceNoteId,
      parentCommentId: null,
    })
      .sort({ createdAt: 1, _id: 1 })
      .populate('userId');

    // 2. Fetch all active replies for this VoiceNote in one query (batched)
    const topLevelIds = topLevelComments.map((c) => c._id);
    const activeReplies = await Comment.find({
      voiceNoteId,
      parentCommentId: { $in: topLevelIds },
      deletedAt: null,
    })
      .sort({ createdAt: 1, _id: 1 })
      .populate('userId');

    // Map replies by parentCommentId string
    const replyMap = {};
    for (const reply of activeReplies) {
      const parentIdStr = reply.parentCommentId.toString();
      if (!replyMap[parentIdStr]) {
        replyMap[parentIdStr] = [];
      }
      replyMap[parentIdStr].push(this.formatComment(reply));
    }

    // 3. Process top-level threads (keep active ones, or deleted ones that have active replies)
    const eligibleThreads = [];
    for (const topLevel of topLevelComments) {
      const replies = replyMap[topLevel._id.toString()] || [];
      const isDeleted = Boolean(topLevel.deletedAt);

      if (isDeleted && replies.length === 0) {
        // Omit deleted top-level comments that have no active replies
        continue;
      }

      const formattedTopLevel = this.formatComment(topLevel);
      formattedTopLevel.replies = replies;
      eligibleThreads.push(formattedTopLevel);
    }

    // 4. Apply pagination to top-level threads
    const total = eligibleThreads.length;
    const totalPages = Math.ceil(total / parsedLimit) || 0;
    const skip = (parsedPage - 1) * parsedLimit;
    const paginatedItems = eligibleThreads.slice(skip, skip + parsedLimit);

    return {
      items: paginatedItems,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Soft-delete a Comment owned by the authenticated user.
   */
  async deleteComment({ voiceNoteId, commentId, userId }) {
    if (!userHasValidId(userId)) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!voiceNoteId || !mongoose.Types.ObjectId.isValid(voiceNoteId.toString())) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote || voiceNote.deletedAt) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    if (!commentId || !mongoose.Types.ObjectId.isValid(commentId.toString())) {
      const err = new Error('Comment not found');
      err.statusCode = 404;
      throw err;
    }

    const comment = await Comment.findOne({ _id: commentId, voiceNoteId });
    if (!comment) {
      const err = new Error('Comment not found');
      err.statusCode = 404;
      throw err;
    }

    if (comment.userId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to delete this comment');
      err.statusCode = 403;
      throw err;
    }

    if (comment.deletedAt) {
      return true; // Already soft deleted (idempotent)
    }

    comment.deletedAt = new Date();
    await comment.save();

    return true;
  }
}

function userHasValidId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId.toString());
}

module.exports = new CommentService();
