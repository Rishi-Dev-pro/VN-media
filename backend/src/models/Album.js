const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema(
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
    coverImage: {
      type: String,
      default: null,
      trim: true,
    },
    visibility: {
      type: String,
      enum: {
        values: ['public', 'private'],
        message: 'Visibility must be either public or private',
      },
      default: 'private',
      required: [true, 'Visibility is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for listing owner albums and public album discovery/search
albumSchema.index({ ownerId: 1, createdAt: -1 });
albumSchema.index({ visibility: 1, createdAt: -1 });
albumSchema.index({ ownerId: 1, visibility: 1, createdAt: -1 });

const Album = mongoose.model('Album', albumSchema);

module.exports = Album;
