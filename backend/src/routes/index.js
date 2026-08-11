const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const voiceNoteRoutes = require('./voiceNote.routes');
const albumRoutes = require('./album.routes');
const activityEventRoutes = require('./activityEvent.routes');
const notificationRoutes = require('./notification.routes');
const conversationRoutes = require('./conversation.routes');
const downloadRoutes = require('./download.routes');

const router = express.Router();

// Register sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vns', voiceNoteRoutes);
router.use('/albums', albumRoutes);
router.use('/activity', activityEventRoutes);
router.use('/notifications', notificationRoutes);
router.use('/conversations', conversationRoutes);
router.use('/downloads', downloadRoutes);

module.exports = router;
