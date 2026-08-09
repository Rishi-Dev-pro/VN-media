const path = require('path');
const VoiceNote = require('../models/VoiceNote');
const storageService = require('./storage.service');
const audioService = require('./audio.service');

// Helper mapping extensions to canonical MIME types for streaming/downloads
const EXT_TO_MIME = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
};

class VoiceNoteService {
  /**
   * Centralized access-control authority for VoiceNote authorization.
   * Single source of truth for public/private visibility rules.
   *
   * @param {object|null} user - Authenticated user object or null/undefined
   * @param {object} voiceNote - Mongoose VoiceNote document
   * @returns {{ allowed: boolean, statusCode?: number, message?: string }}
   */
  canAccessVoiceNote(user, voiceNote) {
    if (voiceNote.visibility === 'public') {
      return { allowed: true };
    }

    // Private VoiceNote
    if (!user || !user._id) {
      return {
        allowed: false,
        statusCode: 401,
        message: 'Authentication required to access private voice note',
      };
    }

    const ownerIdStr = voiceNote.ownerId && voiceNote.ownerId._id
      ? voiceNote.ownerId._id.toString()
      : voiceNote.ownerId
      ? voiceNote.ownerId.toString()
      : '';

    const isOwner = user._id.toString() === ownerIdStr;
    if (isOwner) {
      return { allowed: true };
    }

    return {
      allowed: false,
      statusCode: 403,
      message: 'Access denied: Private voice note',
    };
  }

  /**
   * Helper to derive MIME type from storage reference / extension.
   * @private
   */
  _getMimeTypeFromRef(storageRef) {
    const ext = path.extname(storageRef || '').toLowerCase();
    return EXT_TO_MIME[ext] || 'application/octet-stream';
  }

  /**
   * Create a new VoiceNote document after saving audio file and extracting metadata.
   * Ensures file/database consistency with rollback on error.
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
   * Get paginated public feed of VoiceNotes (visibility = 'public').
   * Accessible to all users (authenticated or logged out).
   */
  async getPublicFeed({ page = 1, limit = 20 }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find({ visibility: 'public' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments({ visibility: 'public' }),
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
   * Get paginated list of VoiceNotes owned by authenticated user.
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
   * Retrieve single VoiceNote document with public/private authorization check.
   */
  async getVoiceNoteById({ voiceNoteId, user }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId).populate('ownerId', 'username');

    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const access = this.canAccessVoiceNote(user, voiceNote);
    if (!access.allowed) {
      const err = new Error(access.message);
      err.statusCode = access.statusCode;
      throw err;
    }

    return voiceNote;
  }

  /**
   * Retrieve streaming information & file stats for audio playback.
   */
  async getVoiceNoteStreamInfo({ voiceNoteId, user }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);

    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const access = this.canAccessVoiceNote(user, voiceNote);
    if (!access.allowed) {
      const err = new Error(access.message);
      err.statusCode = access.statusCode;
      throw err;
    }

    const fileExists = await storageService.fileExists(voiceNote.audioUrl);
    if (!fileExists) {
      const err = new Error('Audio storage file not found');
      err.statusCode = 500;
      throw err;
    }

    const stats = await storageService.getFileStats(voiceNote.audioUrl);
    const mimeType = this._getMimeTypeFromRef(voiceNote.audioUrl);

    return {
      voiceNote,
      fileSize: stats.size,
      mimeType,
      audioUrl: voiceNote.audioUrl,
    };
  }

  /**
   * Retrieve download information & safe filename for file downloads.
   */
  async getVoiceNoteDownloadInfo({ voiceNoteId, user }) {
    const streamInfo = await this.getVoiceNoteStreamInfo({ voiceNoteId, user });
    const { voiceNote } = streamInfo;

    const ext = path.extname(voiceNote.audioUrl || '').toLowerCase();
    const safeTitle = voiceNote.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'voice-note';

    const filename = `${safeTitle}${ext}`;

    return {
      ...streamInfo,
      filename,
    };
  }

  /**
   * Delete a VoiceNote owned by authenticated user and its stored file.
   */
  async deleteVoiceNote({ voiceNoteId, userId }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);

    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const ownerIdStr = voiceNote.ownerId && voiceNote.ownerId._id
      ? voiceNote.ownerId._id.toString()
      : voiceNote.ownerId
      ? voiceNote.ownerId.toString()
      : '';

    if (ownerIdStr !== userId.toString()) {
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
