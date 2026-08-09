const likeService = require('../services/like.service');
const { sendSuccess } = require('../utils/response');

/**
 * Like a VoiceNote.
 * POST /api/vns/:id/like
 */
const likeVoiceNote = async (req, res, next) => {
  try {
    const result = await likeService.likeVoiceNote({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    return sendSuccess(res, 'Voice note liked successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Unlike a VoiceNote.
 * DELETE /api/vns/:id/like
 */
const unlikeVoiceNote = async (req, res, next) => {
  try {
    const result = await likeService.unlikeVoiceNote({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    return sendSuccess(res, 'Voice note unliked successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Get VoiceNote Likes count and likedByMe status.
 * GET /api/vns/:id/likes
 */
const getVoiceNoteLikes = async (req, res, next) => {
  try {
    const result = await likeService.getVoiceNoteLikes({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    return sendSuccess(res, 'Voice note likes retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  likeVoiceNote,
  unlikeVoiceNote,
  getVoiceNoteLikes,
};
