const Like = require('../models/Like');
const VoiceNote = require('../models/VoiceNote');
const voiceNoteService = require('./voiceNote.service');

class LikeService {
  /**
   * Add a Like for a VoiceNote on behalf of an authenticated user.
   * Idempotent operation: if already liked, returns liked: true.
   *
   * @param {object} params
   * @param {string} params.voiceNoteId - Target VoiceNote ID
   * @param {object} params.user - Authenticated user object
   * @returns {Promise<{ liked: boolean }>}
   */
  async likeVoiceNote({ voiceNoteId, user }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote) {
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

    const existingLike = await Like.findOne({ userId: user._id, voiceNoteId });
    if (existingLike) {
      const likeCount = await Like.countDocuments({ voiceNoteId });
      return { liked: true, likeCount };
    }

    try {
      await Like.create({
        userId: user._id,
        voiceNoteId,
      });

      // Record VOICE_NOTE_LIKED activity event ONLY on new Like creation
      const activityEventService = require('./activityEvent.service');
      const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
      await activityEventService.createActivityEvent({
        actorId: user._id,
        type: EVENT_TYPES.VOICE_NOTE_LIKED,
        targetType: TARGET_TYPES.VOICE_NOTE,
        targetId: voiceNoteId,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Handle concurrent duplicate key race condition gracefully
        const likeCount = await Like.countDocuments({ voiceNoteId });
        return { liked: true, likeCount };
      }
      throw err;
    }

    const likeCount = await Like.countDocuments({ voiceNoteId });
    return { liked: true, likeCount };
  }

  /**
   * Remove a Like for a VoiceNote on behalf of an authenticated user.
   * Idempotent operation: if not liked, returns liked: false.
   *
   * @param {object} params
   * @param {string} params.voiceNoteId - Target VoiceNote ID
   * @param {object} params.user - Authenticated user object
   * @returns {Promise<{ liked: boolean }>}
   */
  async unlikeVoiceNote({ voiceNoteId, user }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote) {
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

    await Like.findOneAndDelete({ userId: user._id, voiceNoteId });
    const likeCount = await Like.countDocuments({ voiceNoteId });
    return { liked: false, likeCount };
  }

  /**
   * Get aggregate Like count and likedByMe status for a VoiceNote.
   *
   * @param {object} params
   * @param {string} params.voiceNoteId - Target VoiceNote ID
   * @param {object|null} params.user - Optional requesting user object
   * @returns {Promise<{ count: number, likedByMe: boolean }>}
   */
  async getVoiceNoteLikes({ voiceNoteId, user }) {
    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote) {
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

    const count = await Like.countDocuments({ voiceNoteId });

    let likedByMe = false;
    if (user && user._id) {
      const userLike = await Like.exists({ userId: user._id, voiceNoteId });
      likedByMe = Boolean(userLike);
    }

    return { count, likedByMe };
  }
}

module.exports = new LikeService();
