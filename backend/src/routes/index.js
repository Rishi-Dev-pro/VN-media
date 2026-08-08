const express = require('express');
const healthRoutes = require('./health.routes');

const router = express.Router();

// Register sub-routers
router.use('/health', healthRoutes);

module.exports = router;
