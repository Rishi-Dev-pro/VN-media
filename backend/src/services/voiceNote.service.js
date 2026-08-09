const VoiceNote = require('../models/VoiceNote');
const storageService = require('./storage.service');
const audioService = require('./audio.service');

class VoiceNoteService {
  /**
   * Create a new VoiceNote document after saving audio file and extracting metadata.
   * Ensures file/database consistency with rollback on error.
   *
   * @param {object} params
   * @param {object} params.user - Authenticated user object (req.user)
   * @param {object} params.file - Uploaded file object from Multer (req.file)
   * @param {string} params.title - VoiceNote title
   * @param {string} [params.description] - Optional description
   * @param {string} [params.visibility] - 'public' or 'private'
   * @returns {Promise<object>} Created VoiceNote document
   */
  async createVoiceNote({ user, file, title, description, visibility }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!file || !file.buffer) {
      const err = new Error('Audio file is required');
      err.statusCode = 400;
      throw err;
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      const err = new Error('Title is required');
      err.statusCode = 400;
      throw err;
    }

    if (title.trim().length > 100) {
      const err = new Error('Title cannot exceed 100 characters');
      err.statusCode = 400;
      throw err;
    }

    if (description && description.trim().length > 1000) {
      const err = new Error('Description cannot exceed 1000 characters');
      err.statusCode = 400;
      throw err;
    }

    const validVisibility = visibility || 'public';
    if (!['public', 'private'].includes(validVisibility)) {
      const err = new Error('Visibility must be either public or private');
      err.statusCode = 400;
      throw err;
    }

    // 1. Validate audio format, magic bytes, and extract real duration
    const { extension, duration } = await audioService.validateAndExtractMetadata(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // 2. Save file to storage
    const { storageRef } = await storageService.saveFile(file.buffer, extension);

    // 3. Create MongoDB record with atomicity/rollback guard
    try {
      const voiceNote = await VoiceNote.create({
        ownerId: user._id,
        title: title.trim(),
        description: description ? description.trim() : '',
        audioUrl: storageRef,
        duration,
        visibility: validVisibility,
      });

      return voiceNote;
    } catch (dbError) {
      // Clean up stored audio file if database record creation fails
      await storageService.deleteFile(storageRef);
      throw dbError;
    }
  }

  /**
   * Get paginated list of VoiceNotes owned by authenticated user.
   *
   * @param {object} params
   * @param {string} params.userId - Authenticated user ID
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=20] - Page size limit
   * @returns {Promise<object>} { voiceNotes, pagination }
   */
  async getOwnerVoiceNotes({ userId, page = 1, limit = 20 }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find({ ownerId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      VoiceNote.countDocuments({ ownerId: userId }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 1;

    return {
      voiceNotes,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieve a single VoiceNote owned by authenticated user.
   *
   * @param {object} params
   * @param {string} params.voiceNoteId - Target VoiceNote ID
   * @param {string} params.userId - Requesting user ID
   * @returns {Promise<object>} VoiceNote document
   */
  async getOwnerVoiceNoteById({ voiceNoteId, userId }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);

    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    if (voiceNote.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You can only access your own voice notes');
      err.statusCode = 403;
      throw err;
    }

    return voiceNote;
  }

  /**
   * Delete a VoiceNote owned by authenticated user and its stored file.
   *
   * @param {object} params
   * @param {string} params.voiceNoteId - Target VoiceNote ID
   * @param {string} params.userId - Requesting user ID
   * @returns {Promise<boolean>} True on success
   */
  async deleteVoiceNote({ voiceNoteId, userId }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);

    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    if (voiceNote.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to delete this voice note');
      err.statusCode = 403;
      throw err;
    }

    // 1. Delete stored audio file
    await storageService.deleteFile(voiceNote.audioUrl);

    // 2. Delete database record
    await VoiceNote.findByIdAndDelete(voiceNoteId);

    return true;
  }
}

module.exports = new VoiceNoteService();
