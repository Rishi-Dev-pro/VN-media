const commentService = require('../services/comment.service');
const { sendSuccess } = require('../utils/response');

/**
 * Create a new comment or reply for a VoiceNote.
 * POST /api/vns/:voiceNoteId/comments
 */
const createComment = async (req, res, next) => {
  try {
    const comment = await commentService.createComment({
      voiceNoteId: req.params.voiceNoteId || req.params.id,
      user: req.user,
      content: req.body?.content,
      parentCommentId: req.body?.parentCommentId,
    });

    return sendSuccess(res, 'Comment created successfully', { comment }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated top-level comments and replies for a VoiceNote.
 * GET /api/vns/:voiceNoteId/comments
 */
const getComments = async (req, res, next) => {
  try {
    const { items, pagination } = await commentService.getCommentsForVoiceNote({
      voiceNoteId: req.params.voiceNoteId || req.params.id,
      user: req.user,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Comments retrieved successfully', {
      items,
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Soft-delete a comment owned by authenticated user.
 * DELETE /api/vns/:voiceNoteId/comments/:commentId
 */
const deleteComment = async (req, res, next) => {
  try {
    await commentService.deleteComment({
      voiceNoteId: req.params.voiceNoteId || req.params.id,
      commentId: req.params.commentId,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Comment deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createComment,
  getComments,
  deleteComment,
};
