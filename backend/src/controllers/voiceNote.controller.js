const voiceNoteService = require('../services/voiceNote.service');
const storageService = require('../services/storage.service');
const { sendSuccess } = require('../utils/response');

/**
 * Format VoiceNote document for client responses.
 * @param {object} vn - Mongoose VoiceNote document
 * @returns {object} Formatted VoiceNote object
 */
const formatVoiceNote = (vn) => {
  const formatted = {
    id: vn._id.toString(),
    title: vn.title,
    description: vn.description || '',
    audioUrl: vn.audioUrl,
    duration: vn.duration,
    visibility: vn.visibility,
    tags: vn.tags || [],
    createdAt: vn.createdAt,
    updatedAt: vn.updatedAt,
  };

  if (vn.ownerId && typeof vn.ownerId === 'object' && vn.ownerId.username) {
    formatted.owner = {
      id: vn.ownerId._id.toString(),
      username: vn.ownerId.username,
    };
  } else if (vn.ownerId) {
    formatted.ownerId = vn.ownerId.toString();
  }

  return formatted;
};

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
      tags: req.body?.tags,
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
 * Update metadata of an existing VoiceNote owned by authenticated user.
 * PATCH /api/vns/:id
 */
const updateVoiceNote = async (req, res, next) => {
  try {
    const voiceNote = await voiceNoteService.updateVoiceNoteMetadata({
      voiceNoteId: req.params.id,
      user: req.user,
      title: req.body?.title,
      description: req.body?.description,
      visibility: req.body?.visibility,
      tags: req.body?.tags,
    });

    return sendSuccess(res, 'Voice note updated successfully', {
      voiceNote: formatVoiceNote(voiceNote),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Replace audio file of an existing VoiceNote owned by authenticated user.
 * PATCH /api/vns/:id/audio
 */
const replaceVoiceNoteAudio = async (req, res, next) => {
  try {
    const voiceNote = await voiceNoteService.replaceVoiceNoteAudio({
      voiceNoteId: req.params.id,
      user: req.user,
      file: req.file,
    });

    return sendSuccess(res, 'Voice note audio replaced successfully', {
      voiceNote: formatVoiceNote(voiceNote),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search public VoiceNotes by title, description, or tags.
 * GET /api/vns/search
 */
const searchVoiceNotes = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await voiceNoteService.searchPublicVoiceNotes({
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Voice note search results retrieved successfully', {
      items: voiceNotes.map(formatVoiceNote),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public VoiceNotes matching a specific normalized tag.
 * GET /api/vns/tags/:tag
 */
const getVoiceNotesByTag = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await voiceNoteService.getPublicVoiceNotesByTag({
      tag: req.params.tag,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Voice notes by tag retrieved successfully', {
      items: voiceNotes.map(formatVoiceNote),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get public feed of VoiceNotes (visibility = 'public').
 * GET /api/vns/feed
 */
const getPublicFeed = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await voiceNoteService.getPublicFeed({
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Public feed retrieved successfully', {
      voiceNotes: voiceNotes.map(formatVoiceNote),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get personalized following feed of public VoiceNotes from followed creators.
 * GET /api/vns/feed/following
 */
const getFollowingFeed = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await voiceNoteService.getFollowingFeed({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Following feed retrieved successfully', {
      items: voiceNotes.map(formatVoiceNote),
      pagination,
    });
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
 * Get a single VoiceNote (supports public & authorized private access).
 * GET /api/vns/:id
 */
const getVoiceNoteById = async (req, res, next) => {
  try {
    const voiceNote = await voiceNoteService.getVoiceNoteById({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    return sendSuccess(res, 'Voice note retrieved successfully', {
      voiceNote: formatVoiceNote(voiceNote),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream audio for a VoiceNote with HTTP Range support.
 * GET /api/vns/:id/stream
 */
const streamVoiceNote = async (req, res, next) => {
  try {
    const { fileSize, mimeType, audioUrl } = await voiceNoteService.getVoiceNoteStreamInfo({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    const range = req.headers.range;

    if (!range) {
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.status(200);
      return storageService.createReadStream(audioUrl).pipe(res);
    }

    const matches = range.match(/bytes=(\d*)-(\d*)/);
    if (!matches) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
    }

    const startStr = matches[1];
    const endStr = matches[2];

    const start = startStr !== '' ? parseInt(startStr, 10) : 0;
    const end = endStr !== '' ? parseInt(endStr, 10) : fileSize - 1;

    if (
      isNaN(start) ||
      isNaN(end) ||
      start >= fileSize ||
      end >= fileSize ||
      start > end
    ) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      return res.status(416).json({ success: false, message: 'Requested Range Not Satisfiable' });
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

/**
 * Download audio file for a VoiceNote with Content-Disposition headers.
 * GET /api/vns/:id/download
 */
const downloadVoiceNote = async (req, res, next) => {
  try {
    const { fileSize, mimeType, filename, audioUrl } = await voiceNoteService.getVoiceNoteDownloadInfo({
      voiceNoteId: req.params.id,
      user: req.user,
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return storageService.createReadStream(audioUrl).pipe(res);
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
  formatVoiceNote,
  uploadVoiceNote,
  updateVoiceNote,
  replaceVoiceNoteAudio,
  searchVoiceNotes,
  getVoiceNotesByTag,
  getPublicFeed,
  getFollowingFeed,
  getOwnerVoiceNotes,
  getVoiceNoteById,
  streamVoiceNote,
  downloadVoiceNote,
  deleteVoiceNote,
};
