const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const VoiceNote = require('../models/VoiceNote');
const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
const { NOTIFICATION_TYPES } = require('../utils/notificationTypes');
const { sanitizePublicUser } = require('./user.service');

class NotificationService {
  /**
   * Internal consumer service to create a Notification from an ActivityEvent.
   * Maps event type to recipient identity, enforces self-notification exclusion,
   * and prevents duplicates using unique activityEventId index.
   *
   * @param {object} activityEvent - Mongoose ActivityEvent document
   * @returns {Promise<object|null>} Created Notification document or null
   */
  async createNotificationFromActivityEvent(activityEvent) {
    if (!activityEvent || !activityEvent._id) {
      return null;
    }

    let recipientId = null;
    let actorId = activityEvent.actorId;
    let type = null;
    let targetType = activityEvent.targetType;
    let targetId = activityEvent.targetId;
    let metadata = activityEvent.metadata || {};

    if (activityEvent.type === EVENT_TYPES.USER_FOLLOWED) {
      recipientId = activityEvent.targetId;
      type = NOTIFICATION_TYPES.USER_FOLLOWED;
      targetType = TARGET_TYPES.USER;
      targetId = activityEvent.actorId; // Target is follower profile for recipient inspection
    } else if (activityEvent.type === EVENT_TYPES.VOICE_NOTE_LIKED) {
      const voiceNote = await VoiceNote.findById(activityEvent.targetId).select('ownerId');
      if (!voiceNote || !voiceNote.ownerId) {
        return null;
      }
      recipientId = voiceNote.ownerId;
      type = NOTIFICATION_TYPES.VOICE_NOTE_LIKED;
      targetType = TARGET_TYPES.VOICE_NOTE;
      targetId = activityEvent.targetId;
    } else {
      // VOICE_NOTE_PUBLISHED and ALBUM_CREATED do not generate notifications in Phase 11
      return null;
    }

    // Exclude self-notifications (e.g. user liking their own VoiceNote)
    if (!recipientId || !actorId || recipientId.toString() === actorId.toString()) {
      return null;
    }

    try {
      const notification = await Notification.create({
        recipientId,
        actorId,
        type,
        targetType,
        targetId,
        activityEventId: activityEvent._id,
        metadata,
      });

      return notification;
    } catch (err) {
      if (err.code === 11000) {
        // Idempotent duplicate activityEventId handling
        return Notification.findOne({ activityEventId: activityEvent._id });
      }
      throw err;
    }
  }

  /**
   * Retrieve paginated notifications for the authenticated recipient user.
   *
   * @param {object} params
   * @param {string|object} params.userId - Authenticated user ID (recipient)
   * @param {number|string} [params.page=1] - Requested page number
   * @param {number|string} [params.limit=20] - Requested limit per page
   * @param {boolean|string|null} [params.unread=null] - Optional unread filter
   * @returns {Promise<{ notifications: Array, pagination: object, unreadCount: number }>}
   */
  async getUserNotifications({ userId, page = 1, limit = 20, unread = null }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { recipientId: userId };

    if (unread === true || unread === 'true') {
      query.readAt = null;
    } else if (unread === false || unread === 'false') {
      query.readAt = { $ne: null };
    }

    const [rawNotifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('actorId'),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipientId: userId, readAt: null }),
    ]);

    const notifications = rawNotifications.map((n) => {
      const formattedActor = n.actorId ? sanitizePublicUser(n.actorId) : null;
      return {
        id: n._id.toString(),
        type: n.type,
        actor: formattedActor,
        targetType: n.targetType,
        targetId: n.targetId.toString(),
        metadata: n.metadata || {},
        readAt: n.readAt,
        createdAt: n.createdAt,
      };
    });

    const totalPages = Math.ceil(total / parsedLimit) || 0;

    return {
      notifications,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
      unreadCount,
    };
  }

  /**
   * Mark a single notification owned by recipient user as read.
   *
   * @param {object} params
   * @param {string} params.notificationId - Notification ID
   * @param {string|object} params.userId - Authenticated user ID (recipient)
   * @returns {Promise<object>} Updated Notification object
   */
  async markNotificationAsRead({ notificationId, userId }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!notificationId || !mongoose.Types.ObjectId.isValid(notificationId.toString())) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }

    return notification;
  }

  /**
   * Mark all unread notifications for recipient user as read.
   *
   * @param {object} params
   * @param {string|object} params.userId - Authenticated user ID (recipient)
   * @returns {Promise<{ updatedCount: number }>}
   */
  async markAllNotificationsAsRead({ userId }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const res = await Notification.updateMany(
      { recipientId: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    return { updatedCount: res.modifiedCount };
  }
}

module.exports = new NotificationService();
