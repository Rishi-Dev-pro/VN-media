const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    voiceNoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VoiceNote',
      required: [true, 'Voice Note ID is required'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment content cannot be empty'],
      maxlength: [1000, 'Comment content cannot exceed 1000 characters'],
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying top-level comments on a VoiceNote
commentSchema.index({ voiceNoteId: 1, deletedAt: 1, createdAt: 1 });

// Compound index for querying replies to a parent comment
commentSchema.index({ parentCommentId: 1, deletedAt: 1, createdAt: 1 });

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
