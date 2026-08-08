const mongoose = require('mongoose');

const voiceNoteSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    audioUrl: {
      type: String,
      required: [true, 'Audio URL is required'],
      trim: true,
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [0, 'Duration cannot be negative'],
    },
    visibility: {
      type: String,
      enum: {
        values: ['public', 'private'],
        message: 'Visibility must be either public or private',
      },
      default: 'public',
      required: [true, 'Visibility is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient owner timeline queries
voiceNoteSchema.index({ ownerId: 1, createdAt: -1 });

// Index for chronological public feeds
voiceNoteSchema.index({ visibility: 1, createdAt: -1 });

const VoiceNote = mongoose.model('VoiceNote', voiceNoteSchema);

module.exports = VoiceNote;
