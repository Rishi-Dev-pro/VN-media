const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const voiceNoteRoutes = require('./voiceNote.routes');

const router = express.Router();

// Register sub-routers
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vns', voiceNoteRoutes);

module.exports = router;
