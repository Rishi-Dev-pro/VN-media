const express = require('express');
const notificationController = require('../controllers/notification.controller');
const notificationPreferenceController = require('../controllers/notificationPreference.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications (protected - returns user's notifications)
router.get('/', protect, notificationController.getUserNotifications);

// GET /api/notifications/preferences (protected - returns user's notification preferences)
router.get('/preferences', protect, notificationPreferenceController.getUserPreferences);

// PATCH /api/notifications/preferences (protected - updates user's notification preferences)
router.patch('/preferences', protect, notificationPreferenceController.updateUserPreferences);

// PATCH /api/notifications/read-all (protected - static route MUST be registered before /:id/read)
router.patch('/read-all', protect, notificationController.markAllNotificationsAsRead);

// PATCH /api/notifications/:id/read (protected - marks specific notification as read)
router.patch('/:id/read', protect, notificationController.markNotificationAsRead);

module.exports = router;
