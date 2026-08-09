const albumService = require('../services/album.service');
const { sendSuccess } = require('../utils/response');

/**
 * Format Album document for API responses.
 * @param {object} album - Mongoose Album document
 * @returns {object} Formatted Album object
 */
const formatAlbum = (album) => ({
  id: album._id.toString(),
  ownerId: album.ownerId.toString(),
  title: album.title,
  description: album.description || '',
  coverImage: album.coverImage || null,
  createdAt: album.createdAt,
  updatedAt: album.updatedAt,
});

/**
 * Create a new Album.
 * POST /api/albums
 */
const createAlbum = async (req, res, next) => {
  try {
    const album = await albumService.createAlbum({
      user: req.user,
      title: req.body?.title,
      description: req.body?.description,
      coverImage: req.body?.coverImage,
    });

    return sendSuccess(
      res,
      'Album created successfully',
      { album: formatAlbum(album) },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get paginated list of authenticated user's own Albums.
 * GET /api/albums
 */
const getOwnerAlbums = async (req, res, next) => {
  try {
    const { albums, pagination } = await albumService.getOwnerAlbums({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Albums retrieved successfully', {
      albums: albums.map(formatAlbum),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single Album owned by authenticated user with ordered items.
 * GET /api/albums/:id
 */
const getAlbumById = async (req, res, next) => {
  try {
    const { album, items } = await albumService.getAlbumById({
      albumId: req.params.id,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Album retrieved successfully', {
      album: formatAlbum(album),
      items,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update metadata of an Album owned by authenticated user.
 * PATCH /api/albums/:id
 */
const updateAlbum = async (req, res, next) => {
  try {
    const album = await albumService.updateAlbum({
      albumId: req.params.id,
      userId: req.user._id,
      title: req.body?.title,
      description: req.body?.description,
      coverImage: req.body?.coverImage,
    });

    return sendSuccess(res, 'Album updated successfully', {
      album: formatAlbum(album),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an Album owned by authenticated user.
 * DELETE /api/albums/:id
 */
const deleteAlbum = async (req, res, next) => {
  try {
    await albumService.deleteAlbum({
      albumId: req.params.id,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Album deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Add a VoiceNote to an Album owned by authenticated user.
 * POST /api/albums/:id/items
 */
const addAlbumItem = async (req, res, next) => {
  try {
    const albumItem = await albumService.addAlbumItem({
      albumId: req.params.id,
      userId: req.user._id,
      user: req.user,
      voiceNoteId: req.body?.voiceNoteId,
    });

    return sendSuccess(
      res,
      'Item added to album successfully',
      {
        item: {
          id: albumItem._id.toString(),
          albumId: albumItem.albumId.toString(),
          voiceNoteId: albumItem.voiceNoteId.toString(),
          position: albumItem.position,
          createdAt: albumItem.createdAt,
        },
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Remove an AlbumItem from an Album owned by authenticated user.
 * DELETE /api/albums/:id/items/:itemId
 */
const removeAlbumItem = async (req, res, next) => {
  try {
    await albumService.removeAlbumItem({
      albumId: req.params.id,
      itemId: req.params.itemId,
      userId: req.user._id,
    });

    return sendSuccess(res, 'Item removed from album successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Reorder AlbumItems in an Album owned by authenticated user.
 * PATCH /api/albums/:id/items/reorder
 */
const reorderAlbumItems = async (req, res, next) => {
  try {
    await albumService.reorderAlbumItems({
      albumId: req.params.id,
      userId: req.user._id,
      items: req.body?.items,
    });

    return sendSuccess(res, 'Album items reordered successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAlbum,
  getOwnerAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  addAlbumItem,
  removeAlbumItem,
  reorderAlbumItems,
};
