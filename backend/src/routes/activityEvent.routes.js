const express = require('express');
const activityEventController = require('../controllers/activityEvent.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/activity/me (protected - returns authenticated user's activity events)
router.get('/me', protect, activityEventController.getMyActivityEvents);

module.exports = router;
