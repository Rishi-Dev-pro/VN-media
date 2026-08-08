const mongoose = require('mongoose');

const albumItemSchema = new mongoose.Schema(
  {
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: [true, 'Album ID is required'],
      index: true,
    },
    voiceNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoiceNote',
      required: [true, 'Voice Note ID is required'],
      index: true,
    },
    position: {
      type: Number,
      required: [true, 'Position is required'],
      min: [1, 'Position must be at least 1'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Prevent adding the same voice note multiple times to the same album
albumItemSchema.index({ albumId: 1, voiceNoteId: 1 }, { unique: true });

// Ensure unique ordering position per item inside an album
albumItemSchema.index({ albumId: 1, position: 1 }, { unique: true });

const AlbumItem = mongoose.model('AlbumItem', albumItemSchema);

module.exports = AlbumItem;
