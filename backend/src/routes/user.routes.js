const express = require('express');
const { protect } = require('../middleware/auth');
const { getMe, updateMe } = require('../controllers/user.controller');

const router = express.Router();

// All user routes require JWT authentication
router.use(protect);

// GET /api/users/me
router.get('/me', getMe);

// PATCH /api/users/me
router.patch('/me', updateMe);

module.exports = router;
