const notificationService = require('../services/notification.service');
const { sendSuccess } = require('../utils/response');

/**
 * Get paginated notifications for the authenticated user.
 * GET /api/notifications
 */
const getUserNotifications = async (req, res, next) => {
  try {
    const { notifications, pagination, unreadCount } = await notificationService.getUserNotifications({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
      unread: req.query.unread,
    });

    return sendSuccess(res, 'Notifications retrieved successfully', {
      items: notifications,
      pagination,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification owned by authenticated user as read.
 * PATCH /api/notifications/:id/read
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    await notificationService.markNotificationAsRead({
      notificationId: req.params.id,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Notification marked as read', { read: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all unread notifications for authenticated user as read.
 * PATCH /api/notifications/read-all
 */
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const { updatedCount } = await notificationService.markAllNotificationsAsRead({
      userId: req.user._id,
    });

    return sendSuccess(res, 'Notifications marked as read', { updatedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
