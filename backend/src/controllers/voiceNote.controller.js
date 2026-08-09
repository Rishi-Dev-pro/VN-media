const voiceNoteService = require('../services/voiceNote.service');
const { sendSuccess } = require('../utils/response');

/**
 * Format VoiceNote document for client responses.
 * @param {object} vn - Mongoose VoiceNote document
 * @returns {object} Formatted VoiceNote object
 */
const formatVoiceNote = (vn) => ({
  id: vn._id.toString(),
  ownerId: vn.ownerId.toString(),
  title: vn.title,
  description: vn.description || '',
  audioUrl: vn.audioUrl,
  duration: vn.duration,
  visibility: vn.visibility,
  createdAt: vn.createdAt,
  updatedAt: vn.updatedAt,
});

/**
 * Upload audio file and create VoiceNote.
 * POST /api/vns
 */
const uploadVoiceNote = async (req, res, next) => {
  try {
    const voiceNote = await voiceNoteService.createVoiceNote({
      user: req.user,
      file: req.file,
      title: req.body?.title,
      description: req.body?.description,
      visibility: req.body?.visibility,
    });

    return sendSuccess(
      res,
      'Voice note uploaded successfully',
      { voiceNote: formatVoiceNote(voiceNote) },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated list of authenticated user's own VoiceNotes.
 * GET /api/vns/me
 */
const getOwnerVoiceNotes = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await voiceNoteService.getOwnerVoiceNotes({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Voice notes retrieved successfully', {
      voiceNotes: voiceNotes.map(formatVoiceNote),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single VoiceNote owned by authenticated user.
 * GET /api/vns/:id
 */
const getOwnerVoiceNoteById = async (req, res, next) => {
  try {
    const voiceNote = await voiceNoteService.getOwnerVoiceNoteById({
      voiceNoteId: req.params.id,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Voice note retrieved successfully', {
      voiceNote: formatVoiceNote(voiceNote),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a VoiceNote owned by authenticated user.
 * DELETE /api/vns/:id
 */
const deleteVoiceNote = async (req, res, next) => {
  try {
    await voiceNoteService.deleteVoiceNote({
      voiceNoteId: req.params.id,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Voice note deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadVoiceNote,
  getOwnerVoiceNotes,
  getOwnerVoiceNoteById,
  deleteVoiceNote,
};
