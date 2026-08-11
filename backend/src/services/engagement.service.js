const Like = require('../models/Like');
const mongoose = require('mongoose');

/**
 * Engagement enrichment service providing batched, N+1-free Like metadata
 * for VoiceNote collections and single VoiceNote responses.
 *
 * Phase 16: Reusable helper consumed by controllers to add likeCount and likedByMe
 * to formatted VoiceNote objects without moving business logic into controllers.
 */
class EngagementService {
  /**
   * Enrich an array of formatted VoiceNote objects with engagement metadata.
   * Uses batched queries to avoid N+1 problems.
   *
   * Query complexity: 2 queries for authenticated users, 1 for guests —
   * regardless of collection size.
   *
   * @param {Array<object>} formattedVoiceNotes - Array of formatted VoiceNote objects (must have `id` field)
   * @param {object|null} user - Authenticated user object or null
   * @returns {Promise<Array<object>>} VoiceNotes enriched with likeCount and likedByMe
   */
  async enrichVoiceNotesWithEngagement(formattedVoiceNotes, user) {
    if (!formattedVoiceNotes || formattedVoiceNotes.length === 0) {
      return formattedVoiceNotes || [];
    }

    // Collect all VoiceNote IDs from the formatted objects
    const voiceNoteIds = formattedVoiceNotes
      .map((vn) => vn.id)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (voiceNoteIds.length === 0) {
      return formattedVoiceNotes.map((vn) => ({
        ...vn,
        likeCount: 0,
        likedByMe: false,
      }));
    }

    // Batch query 1: Aggregate Like counts for all VoiceNotes in one query
    const countResults = await Like.aggregate([
      { $match: { voiceNoteId: { $in: voiceNoteIds } } },
      { $group: { _id: '$voiceNoteId', count: { $sum: 1 } } },
    ]);

    // Build count map: voiceNoteId string → count
    const countMap = {};
    for (const result of countResults) {
      countMap[result._id.toString()] = result.count;
    }

    // Batch query 2: Get current user's likes for all VoiceNotes (auth only)
    let likedByMeSet = new Set();
    if (user && user._id) {
      const userLikes = await Like.find({
        userId: user._id,
        voiceNoteId: { $in: voiceNoteIds },
      }).select('voiceNoteId');

      for (const like of userLikes) {
        likedByMeSet.add(like.voiceNoteId.toString());
      }
    }

    // Map engagement metadata onto each formatted VoiceNote
    return formattedVoiceNotes.map((vn) => ({
      ...vn,
      likeCount: countMap[vn.id] || 0,
      likedByMe: likedByMeSet.has(vn.id),
    }));
  }

  /**
   * Enrich a single formatted VoiceNote object with engagement metadata.
   * Uses individual queries (optimal for single-document responses).
   *
   * @param {object} formattedVoiceNote - Formatted VoiceNote object (must have `id` field)
   * @param {object|null} user - Authenticated user object or null
   * @returns {Promise<object>} VoiceNote enriched with likeCount and likedByMe
   */
  async enrichSingleVoiceNoteWithEngagement(formattedVoiceNote, user) {
    if (!formattedVoiceNote || !formattedVoiceNote.id) {
      return formattedVoiceNote;
    }

    const voiceNoteId = formattedVoiceNote.id;

    const count = await Like.countDocuments({ voiceNoteId });

    let likedByMe = false;
    if (user && user._id) {
      const userLike = await Like.exists({ userId: user._id, voiceNoteId });
      likedByMe = Boolean(userLike);
    }

    return {
      ...formattedVoiceNote,
      likeCount: count,
      likedByMe,
    };
  }
}

module.exports = new EngagementService();
