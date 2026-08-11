const mongoose = require('mongoose');

const downloadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ['voicenote', 'message_audio'],
      required: true,
    },
    voiceNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoiceNote',
      default: null,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    deviceId: {
      type: String,
      default: 'default_device',
      trim: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed', 'failed', 'revoked'],
      default: 'pending',
      index: true,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    downloadUrl: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
      maxlength: 250,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Validate that exactly one media target (voiceNoteId XOR messageId) is populated
downloadSchema.pre('validate', function (next) {
  const hasVn = Boolean(this.voiceNoteId);
  const hasMsg = Boolean(this.messageId);

  if ((hasVn && hasMsg) || (!hasVn && !hasMsg)) {
    return next(new Error('Download record must target exactly one media item (voiceNoteId or messageId)'));
  }

  next();
});

// Compound unique index enforcing unique download tracking per user + target media + device
downloadSchema.index(
  { userId: 1, mediaType: 1, voiceNoteId: 1, messageId: 1, deviceId: 1 },
  { unique: true }
);

// Secondary compound index for user download listing
downloadSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Download', downloadSchema);
