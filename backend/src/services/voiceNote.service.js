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

// Search & Tag Validation Constants
const MAX_TAGS_PER_VOICE_NOTE = 10;
const MAX_TAG_LENGTH = 30;
const MAX_SEARCH_QUERY_LENGTH = 100;

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
    if (voiceNote.deletedAt) {
      return {
        allowed: false,
        statusCode: 404,
        message: 'Voice note not found',
      };
    }

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
   * Parse, normalize, and validate input tags.
   * Rules: trim, lowercase, collapse whitespace, deduplicate, max 10 tags, max 30 chars per tag.
   * @private
   */
  _normalizeAndValidateTags(inputTags) {
    if (inputTags === undefined || inputTags === null) {
      return [];
    }

    let rawList = [];
    if (typeof inputTags === 'string') {
      const trimmed = inputTags.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          rawList = JSON.parse(trimmed);
        } catch {
          rawList = trimmed.replace(/^\[|\]$/g, '').split(',');
        }
      } else if (trimmed.includes(',')) {
        rawList = trimmed.split(',');
      } else if (trimmed !== '') {
        rawList = [trimmed];
      }
    } else if (Array.isArray(inputTags)) {
      rawList = inputTags;
    }

    if (!Array.isArray(rawList)) {
      return [];
    }

    const normalizedList = [];

    for (const rawTag of rawList) {
      if (typeof rawTag !== 'string') continue;
      const tagStr = rawTag.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!tagStr) continue;

      if (tagStr.length > MAX_TAG_LENGTH) {
        const err = new Error(`Tag length cannot exceed ${MAX_TAG_LENGTH} characters`);
        err.statusCode = 400;
        throw err;
      }

      normalizedList.push(tagStr);
    }

    const uniqueTags = Array.from(new Set(normalizedList));

    if (uniqueTags.length > MAX_TAGS_PER_VOICE_NOTE) {
      const err = new Error(`Cannot exceed ${MAX_TAGS_PER_VOICE_NOTE} tags per voice note`);
      err.statusCode = 400;
      throw err;
    }

    return uniqueTags;
  }

  /**
   * Create a new VoiceNote document after saving audio file and extracting metadata.
   * Ensures file/database consistency with rollback on error.
   */
  async createVoiceNote({ user, file, title, description, visibility, tags }) {
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

    const normalizedTags = this._normalizeAndValidateTags(tags);

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
        tags: normalizedTags,
      });

      if (validVisibility === 'public') {
        try {
          const activityEventService = require('./activityEvent.service');
          const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
          await activityEventService.createActivityEvent({
            actorId: user._id,
            type: EVENT_TYPES.VOICE_NOTE_PUBLISHED,
            targetType: TARGET_TYPES.VOICE_NOTE,
            targetId: voiceNote._id,
          });
        } catch (actErr) {
          console.error('[VoiceNoteService] ActivityEvent creation failed during createVoiceNote:', actErr.message || actErr);
        }
      }

      return voiceNote;
    } catch (dbError) {
      // Clean up stored audio file if database record creation fails
      await storageService.deleteFile(storageRef);
      throw dbError;
    }
  }

  /**
   * Update metadata of an existing VoiceNote owned by authenticated user.
   */
  async updateVoiceNoteMetadata({ voiceNoteId, user, title, description, visibility, tags }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote || voiceNote.deletedAt) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const ownerIdStr = voiceNote.ownerId && voiceNote.ownerId._id
      ? voiceNote.ownerId._id.toString()
      : voiceNote.ownerId
      ? voiceNote.ownerId.toString()
      : '';

    if (ownerIdStr !== user._id.toString()) {
      const err = new Error('Access denied: You do not have permission to update this voice note');
      err.statusCode = 403;
      throw err;
    }

    const previousVisibility = voiceNote.visibility;

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        const err = new Error('Title cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      if (title.trim().length > 100) {
        const err = new Error('Title cannot exceed 100 characters');
        err.statusCode = 400;
        throw err;
      }
      voiceNote.title = title.trim();
    }

    if (description !== undefined) {
      if (description && description.trim().length > 1000) {
        const err = new Error('Description cannot exceed 1000 characters');
        err.statusCode = 400;
        throw err;
      }
      voiceNote.description = description ? description.trim() : '';
    }

    if (visibility !== undefined) {
      if (!['public', 'private'].includes(visibility)) {
        const err = new Error('Visibility must be either public or private');
        err.statusCode = 400;
        throw err;
      }
      voiceNote.visibility = visibility;
    }

    if (tags !== undefined) {
      voiceNote.tags = this._normalizeAndValidateTags(tags);
    }

    await voiceNote.save();

    // Emit VOICE_NOTE_PUBLISHED event ONLY if visibility transitioned from private -> public
    if (previousVisibility === 'private' && voiceNote.visibility === 'public') {
      try {
        const activityEventService = require('./activityEvent.service');
        const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
        await activityEventService.createActivityEvent({
          actorId: user._id,
          type: EVENT_TYPES.VOICE_NOTE_PUBLISHED,
          targetType: TARGET_TYPES.VOICE_NOTE,
          targetId: voiceNote._id,
        });
      } catch (actErr) {
        console.error('[VoiceNoteService] ActivityEvent creation failed during updateVoiceNoteMetadata:', actErr.message || actErr);
      }
    }

    return voiceNote;
  }

  /**
   * Replace audio file of an existing VoiceNote owned by authenticated user.
   * Failure-safe sequence: Validate & Save new file -> Update DB -> Clean up old file.
   */
  async replaceVoiceNoteAudio({ voiceNoteId, user, file }) {
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

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote || voiceNote.deletedAt) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    const ownerIdStr = voiceNote.ownerId && voiceNote.ownerId._id
      ? voiceNote.ownerId._id.toString()
      : voiceNote.ownerId
      ? voiceNote.ownerId.toString()
      : '';

    if (ownerIdStr !== user._id.toString()) {
      const err = new Error('Access denied: You do not have permission to replace audio for this voice note');
      err.statusCode = 403;
      throw err;
    }

    // 1. Validate new audio format, magic bytes, and extract metadata
    const { extension, duration } = await audioService.validateAndExtractMetadata(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // 2. Save new file to storage
    const { storageRef: newStorageRef } = await storageService.saveFile(file.buffer, extension);

    // 3. Atomically update DB record; if DB update fails, remove new file and keep old audio untouched
    const oldStorageRef = voiceNote.audioUrl;

    try {
      voiceNote.audioUrl = newStorageRef;
      voiceNote.duration = duration;
      await voiceNote.save();

      // Clean up old audio file ONLY after DB update succeeds
      if (oldStorageRef && oldStorageRef !== newStorageRef) {
        await storageService.deleteFile(oldStorageRef);
      }

      return voiceNote;
    } catch (dbError) {
      // DB update failed: delete newly stored audio file so old audio file remains active and intact
      await storageService.deleteFile(newStorageRef);
      throw dbError;
    }
  }

  /**
   * Search public VoiceNotes across title, description, and tags.
   * MANDATORY: Strictly queries visibility = 'public'.
   */
  async searchPublicVoiceNotes({ q, page = 1, limit = 20 }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { visibility: 'public', deletedAt: null };

    if (q && typeof q === 'string' && q.trim()) {
      const trimmedQ = q.trim();
      if (trimmedQ.length > MAX_SEARCH_QUERY_LENGTH) {
        const err = new Error(`Search query cannot exceed ${MAX_SEARCH_QUERY_LENGTH} characters`);
        err.statusCode = 400;
        throw err;
      }

      const escapedQ = trimmedQ.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const searchRegex = new RegExp(escapedQ, 'i');

      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ];
    }

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

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
   * Tag-based discovery for public VoiceNotes matching a normalized tag.
   * MANDATORY: Strictly queries visibility = 'public'.
   */
  async getPublicVoiceNotesByTag({ tag, page = 1, limit = 20 }) {
    if (!tag || typeof tag !== 'string' || !tag.trim()) {
      const err = new Error('Tag parameter is required');
      err.statusCode = 400;
      throw err;
    }

    const normalizedTag = tag.trim().toLowerCase().replace(/\s+/g, ' ');
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { visibility: 'public', tags: normalizedTag, deletedAt: null };

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

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
   * Get paginated public feed of VoiceNotes (visibility = 'public').
   * Accessible to all users (authenticated or logged out).
   */
  async getPublicFeed({ page = 1, limit = 20 }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { visibility: 'public', deletedAt: null };

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments(query),
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
   * Get paginated personalized feed of public VoiceNotes uploaded by creators followed by user.
   * MANDATORY: Requires authentication, strictly filters visibility = 'public'.
   */
  async getFollowingFeed({ userId, page = 1, limit = 20 }) {
    if (!userId) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const Follow = require('../models/Follow');

    // 1. Find all user IDs followed by current user
    const follows = await Follow.find({ followerId: userId }).select('followingId');
    const followedUserIds = follows.map((f) => f.followingId);

    if (followedUserIds.length === 0) {
      return {
        voiceNotes: [],
        pagination: {
          page: parsedPage,
          limit: parsedLimit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // 2. Query public VoiceNotes created by followed users
    const query = { ownerId: { $in: followedUserIds }, visibility: 'public', deletedAt: null };

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

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

    const query = { ownerId: userId, deletedAt: null };

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      VoiceNote.countDocuments(query),
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

    if (!voiceNote || voiceNote.deletedAt) {
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

    if (!voiceNote || voiceNote.deletedAt) {
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
      err.statusCode = 404;
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
   * Soft-delete a VoiceNote owned by authenticated user.
   */
  async deleteVoiceNote({ voiceNoteId, userId }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);

    if (!voiceNote || voiceNote.deletedAt) {
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

    // Soft-delete by setting deletedAt timestamp
    voiceNote.deletedAt = new Date();
    await voiceNote.save();

    return true;
  }
}

module.exports = new VoiceNoteService();
