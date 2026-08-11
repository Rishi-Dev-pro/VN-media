const express = require('express');
const downloadController = require('../controllers/download.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All download tracking & state management endpoints require authentication
router.use(protect);

router.post('/', downloadController.initiateDownload);
router.get('/', downloadController.getUserDownloads);
router.get('/:id', downloadController.getDownloadById);
router.patch('/:id', downloadController.updateDownloadStatus);

module.exports = router;
