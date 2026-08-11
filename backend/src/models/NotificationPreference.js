const mongoose = require('mongoose');
const { DEFAULT_PREFERENCES } = require('../utils/notificationPreferences');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    userFollowed: {
      type: Boolean,
      default: DEFAULT_PREFERENCES.userFollowed,
    },
    voiceNoteLiked: {
      type: Boolean,
      default: DEFAULT_PREFERENCES.voiceNoteLiked,
    },
    voiceNoteCommented: {
      type: Boolean,
      default: DEFAULT_PREFERENCES.voiceNoteCommented,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  }
);

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

module.exports = NotificationPreference;
