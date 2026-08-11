const downloadService = require('../services/download.service');
const { sendSuccess } = require('../utils/response');

/**
 * Initiate or record a media download request for a VoiceNote or private audio Message.
 * POST /api/downloads
 */
const initiateDownload = async (req, res, next) => {
  try {
    const { mediaType, voiceNoteId, messageId, deviceId } = req.body || {};

    const download = await downloadService.initiateDownload({
      reqUser: req.user,
      mediaType,
      voiceNoteId,
      messageId,
      deviceId,
    });

    return sendSuccess(res, 'Download initiated successfully', { download }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve user's download records with dynamic authorization re-evaluation.
 * GET /api/downloads
 */
const getUserDownloads = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;

    const result = await downloadService.getUserDownloads({
      reqUser: req.user,
      page,
      limit,
      status,
    });

    return sendSuccess(res, 'Downloads retrieved successfully', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve single download record by ID.
 * GET /api/downloads/:id
 */
const getDownloadById = async (req, res, next) => {
  try {
    const download = await downloadService.getDownloadById({
      downloadId: req.params.id,
      reqUser: req.user,
    });

    return sendSuccess(res, 'Download retrieved successfully', { download });
  } catch (error) {
    next(error);
  }
};

/**
 * Update download lifecycle status (pending, active, completed, failed, revoked).
 * PATCH /api/downloads/:id
 */
const updateDownloadStatus = async (req, res, next) => {
  try {
    const { status, errorMessage } = req.body || {};

    const download = await downloadService.updateDownloadStatus({
      downloadId: req.params.id,
      reqUser: req.user,
      status,
      errorMessage,
    });

    return sendSuccess(res, 'Download status updated successfully', { download });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateDownload,
  getUserDownloads,
  getDownloadById,
  updateDownloadStatus,
};
