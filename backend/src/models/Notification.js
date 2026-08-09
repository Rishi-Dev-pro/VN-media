const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../utils/notificationTypes');
const { TARGET_TYPES } = require('../utils/activityEvents');

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(NOTIFICATION_TYPES),
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
    activityEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ActivityEvent',
      required: true,
      unique: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    readAt: {
      type: Date,
      default: null,
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

// Index supporting recipient notifications retrieval (newest first)
notificationSchema.index({ recipientId: 1, createdAt: -1 });

// Index supporting unread notifications count and filtering
notificationSchema.index({ recipientId: 1, readAt: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
