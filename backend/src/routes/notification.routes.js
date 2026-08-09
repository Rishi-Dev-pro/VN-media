const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications (protected - returns user's notifications)
router.get('/', protect, notificationController.getUserNotifications);

// PATCH /api/notifications/read-all (protected - static route MUST be registered before /:id/read)
router.patch('/read-all', protect, notificationController.markAllNotificationsAsRead);

// PATCH /api/notifications/:id/read (protected - marks specific notification as read)
router.patch('/:id/read', protect, notificationController.markNotificationAsRead);

module.exports = router;
