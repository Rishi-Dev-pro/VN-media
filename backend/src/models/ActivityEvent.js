const mongoose = require('mongoose');
const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');

const activityEventSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(EVENT_TYPES),
    },
    targetType: {
      type: String,
      required: true,
      enum: Object.values(TARGET_TYPES),
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

// Index supporting authenticated user activity feed retrieval (newest first)
activityEventSchema.index({ actorId: 1, createdAt: -1 });

// Index supporting target-based activity lookup
activityEventSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema);

module.exports = ActivityEvent;
