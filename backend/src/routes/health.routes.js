const express = require('express');
const { getHealth, getReadiness } = require('../controllers/health.controller');

const router = express.Router();

// GET /api/health & GET /api/health/ready
router.get('/', getHealth);
router.get('/ready', getReadiness);

module.exports = router;
