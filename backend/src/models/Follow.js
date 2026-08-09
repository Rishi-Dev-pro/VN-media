const mongoose = require('mongoose');

const followSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower ID is required'],
      index: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following ID is required'],
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Enforce unique follow relationship per pair at the database level
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

// Index for optimizing follower lookup queries (Follow.find({ followingId: targetUserId }))
followSchema.index({ followingId: 1, followerId: 1 });

const Follow = mongoose.model('Follow', followSchema);

module.exports = Follow;
