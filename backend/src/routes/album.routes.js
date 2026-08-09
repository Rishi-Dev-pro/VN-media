const express = require('express');
const albumController = require('../controllers/album.controller');
const { protect, protectOptional } = require('../middleware/auth');

const router = express.Router();

// Public Discovery & Search (Unauthenticated / Optional Auth)
router.get('/discover', protectOptional, albumController.getPublicAlbums);
router.get('/search', protectOptional, albumController.searchAlbums);

// Owner-scoped list (Requires Auth)
router.get('/', protect, albumController.getOwnerAlbums);

// Create Album (Requires Auth)
router.post('/', protect, albumController.createAlbum);

// Single Album access (Public if visibility='public', Owner-only if visibility='private')
router.get('/:id', protectOptional, albumController.getAlbumById);
router.patch('/:id', protect, albumController.updateAlbum);
router.delete('/:id', protect, albumController.deleteAlbum);

// Album Item management endpoints (Requires Auth)
router.post('/:id/items', protect, albumController.addAlbumItem);
router.patch('/:id/items/reorder', protect, albumController.reorderAlbumItems);
router.delete('/:id/items/:itemId', protect, albumController.removeAlbumItem);

module.exports = router;
