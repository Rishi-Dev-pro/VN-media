const express = require('express');
const { register, login } = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/auth/register
router.post('/register', authLimiter, register);

// POST /api/auth/login
router.post('/login', authLimiter, login);

module.exports = router;
