const express = require('express');
const albumController = require('../controllers/album.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All album routes require authentication in Phase 5
router.use(protect);

// Album CRUD endpoints
router.post('/', albumController.createAlbum);
router.get('/', albumController.getOwnerAlbums);
router.get('/:id', albumController.getAlbumById);
router.patch('/:id', albumController.updateAlbum);
router.delete('/:id', albumController.deleteAlbum);

// Album Item management endpoints
router.post('/:id/items', albumController.addAlbumItem);
router.patch('/:id/items/reorder', albumController.reorderAlbumItems);
router.delete('/:id/items/:itemId', albumController.removeAlbumItem);

module.exports = router;
