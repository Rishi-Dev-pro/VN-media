const notificationPreferenceService = require('../services/notificationPreference.service');
const { sendSuccess } = require('../utils/response');

/**
 * Retrieve notification preferences for the authenticated user.
 * GET /api/notifications/preferences
 */
const getUserPreferences = async (req, res, next) => {
  try {
    const preferences = await notificationPreferenceService.getUserNotificationPreferences(req.user._id);

    return sendSuccess(res, 'Notification preferences retrieved successfully', {
      preferences,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences for the authenticated user.
 * PATCH /api/notifications/preferences
 */
const updateUserPreferences = async (req, res, next) => {
  try {
    const preferences = await notificationPreferenceService.updateUserNotificationPreferences(
      req.user._id,
      req.body
    );

    return sendSuccess(res, 'Notification preferences updated successfully', {
      preferences,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserPreferences,
  updateUserPreferences,
};
