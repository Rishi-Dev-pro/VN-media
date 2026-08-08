const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    voiceNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoiceNote',
      required: [true, 'Voice Note ID is required'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Enforce unique likes per user per voice note at the database level
likeSchema.index({ userId: 1, voiceNoteId: 1 }, { unique: true });

const Like = mongoose.model('Like', likeSchema);

module.exports = Like;
