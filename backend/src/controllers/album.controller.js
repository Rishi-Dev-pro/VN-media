const albumService = require('../services/album.service');
const { sendSuccess } = require('../utils/response');

/**
 * Format Album document for API responses.
 * @param {object} album - Mongoose Album document or plain JS object
 * @returns {object} Formatted Album object
 */
const formatAlbum = (album) => {
  if (!album) return null;

  const albumObj = typeof album.toObject === 'function' ? album.toObject() : album;

  const formatted = {
    id: albumObj._id ? albumObj._id.toString() : albumObj.id,
    title: albumObj.title,
    description: albumObj.description || '',
    coverImage: albumObj.coverImage || null,
    visibility: albumObj.visibility || 'private',
    createdAt: albumObj.createdAt,
    updatedAt: albumObj.updatedAt,
  };

  if (albumObj.ownerId && typeof albumObj.ownerId === 'object' && albumObj.ownerId.username) {
    formatted.owner = {
      id: albumObj.ownerId._id.toString(),
      username: albumObj.ownerId.username,
      avatar: albumObj.ownerId.avatar || null,
      bio: albumObj.ownerId.bio || '',
    };
  } else if (albumObj.ownerId) {
    formatted.ownerId = albumObj.ownerId.toString();
  }

  if (typeof albumObj.publicItemCount === 'number') {
    formatted.publicItemCount = albumObj.publicItemCount;
  }

  return formatted;
};

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
      visibility: req.body?.visibility,
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
 * Get paginated list of public Albums for discovery.
 * GET /api/albums/discover
 */
const getPublicAlbums = async (req, res, next) => {
  try {
    const { albums, pagination } = await albumService.getPublicAlbums({
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Public albums retrieved successfully', {
      albums: albums.map(formatAlbum),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search public Albums by title or description.
 * GET /api/albums/search
 */
const searchAlbums = async (req, res, next) => {
  try {
    const { albums, pagination } = await albumService.searchPublicAlbums({
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Albums search completed successfully', {
      items: albums.map(formatAlbum),
      pagination,
    });
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
 * Get single Album (public or owner access) with ordered items.
 * GET /api/albums/:id
 */
const getAlbumById = async (req, res, next) => {
  try {
    const { album, items } = await albumService.getAlbumById({
      albumId: req.params.id,
      user: req.user,
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
      visibility: req.body?.visibility,
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
  formatAlbum,
  createAlbum,
  getPublicAlbums,
  searchAlbums,
  getOwnerAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  addAlbumItem,
  removeAlbumItem,
  reorderAlbumItems,
};
