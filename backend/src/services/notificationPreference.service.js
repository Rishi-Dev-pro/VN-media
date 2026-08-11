const mongoose = require('mongoose');
const NotificationPreference = require('../models/NotificationPreference');
const { PREFERENCE_KEYS, DEFAULT_PREFERENCES } = require('../utils/notificationPreferences');
const { NOTIFICATION_TYPES } = require('../utils/notificationTypes');

class NotificationPreferenceService {
  /**
   * Retrieve notification preferences for a user, lazily creating defaults if absent.
   *
   * @param {string|object} userId - User ID
   * @returns {Promise<{ userFollowed: boolean, voiceNoteLiked: boolean }>}
   */
  async getUserNotificationPreferences(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const prefs = await NotificationPreference.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          userFollowed: DEFAULT_PREFERENCES.userFollowed,
          voiceNoteLiked: DEFAULT_PREFERENCES.voiceNoteLiked,
          voiceNoteCommented: DEFAULT_PREFERENCES.voiceNoteCommented,
        },
      },
      { new: true, upsert: true }
    );

    return {
      userFollowed: prefs.userFollowed,
      voiceNoteLiked: prefs.voiceNoteLiked,
      voiceNoteCommented: prefs.voiceNoteCommented !== false,
    };
  }

  /**
   * Update notification preferences for a user (supports partial updates).
   * Validates key existence and strict boolean type.
   *
   * @param {string|object} userId - User ID
   * @param {object} updates - Updates object (e.g. { voiceNoteLiked: false })
   * @returns {Promise<{ userFollowed: boolean, voiceNoteLiked: boolean, voiceNoteCommented: boolean }>}
   */
  async updateUserNotificationPreferences(userId, updates) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates) || Object.keys(updates).length === 0) {
      const err = new Error('No preference updates provided');
      err.statusCode = 400;
      throw err;
    }

    const allowedKeys = Object.values(PREFERENCE_KEYS);

    for (const key of Object.keys(updates)) {
      if (!allowedKeys.includes(key)) {
        const err = new Error(`Invalid preference key: ${key}`);
        err.statusCode = 400;
        throw err;
      }

      if (typeof updates[key] !== 'boolean') {
        const err = new Error(`Preference value for ${key} must be a boolean`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updateFields = {};
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        updateFields[key] = updates[key];
      }
    }

    const prefs = await NotificationPreference.findOneAndUpdate(
      { userId },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );

    return {
      userFollowed: prefs.userFollowed,
      voiceNoteLiked: prefs.voiceNoteLiked,
      voiceNoteCommented: prefs.voiceNoteCommented !== false,
    };
  }

  /**
   * Check if a specific notification type is enabled for a recipient user.
   *
   * @param {string|object} userId - Recipient User ID
   * @param {string} notificationType - Notification type (USER_FOLLOWED, VOICE_NOTE_LIKED, or VOICE_NOTE_COMMENTED)
   * @returns {Promise<boolean>} True if notification is enabled, false if suppressed
   */
  async checkPreference(userId, notificationType) {
    if (!userId) return true;

    const prefs = await this.getUserNotificationPreferences(userId);

    if (notificationType === NOTIFICATION_TYPES.USER_FOLLOWED) {
      return prefs.userFollowed !== false;
    }

    if (notificationType === NOTIFICATION_TYPES.VOICE_NOTE_LIKED) {
      return prefs.voiceNoteLiked !== false;
    }

    if (notificationType === NOTIFICATION_TYPES.VOICE_NOTE_COMMENTED) {
      return prefs.voiceNoteCommented !== false;
    }

    return true;
  }
}

module.exports = new NotificationPreferenceService();
