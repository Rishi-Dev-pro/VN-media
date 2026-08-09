const Album = require('../models/Album');
const AlbumItem = require('../models/AlbumItem');
const VoiceNote = require('../models/VoiceNote');
const voiceNoteService = require('./voiceNote.service');

/**
 * Format VoiceNote object for Album responses.
 * @param {object} vn - Mongoose VoiceNote document
 * @returns {object} Formatted VoiceNote object
 */
const formatVoiceNote = (vn) => {
  if (!vn) return null;

  const formatted = {
    id: vn._id.toString(),
    title: vn.title,
    description: vn.description || '',
    duration: vn.duration,
    visibility: vn.visibility,
    createdAt: vn.createdAt,
    updatedAt: vn.updatedAt,
  };

  if (vn.ownerId && typeof vn.ownerId === 'object' && vn.ownerId.username) {
    formatted.owner = {
      id: vn.ownerId._id.toString(),
      username: vn.ownerId.username,
    };
  } else if (vn.ownerId) {
    formatted.ownerId = vn.ownerId.toString();
  }

  return formatted;
};

class AlbumService {
  /**
   * Create a new Album owned by the authenticated user.
   */
  async createAlbum({ user, title, description, coverImage }) {
    if (!user || !user._id) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      const err = new Error('Title is required');
      err.statusCode = 400;
      throw err;
    }

    if (title.trim().length > 100) {
      const err = new Error('Title cannot exceed 100 characters');
      err.statusCode = 400;
      throw err;
    }

    if (description && description.trim().length > 1000) {
      const err = new Error('Description cannot exceed 1000 characters');
      err.statusCode = 400;
      throw err;
    }

    const album = await Album.create({
      ownerId: user._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      coverImage: coverImage ? coverImage.trim() : null,
    });

    // Record ALBUM_CREATED activity event
    const activityEventService = require('./activityEvent.service');
    const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');
    await activityEventService.createActivityEvent({
      actorId: user._id,
      type: EVENT_TYPES.ALBUM_CREATED,
      targetType: TARGET_TYPES.ALBUM,
      targetId: album._id,
    });

    return album;
  }

  /**
   * Get paginated list of Albums owned by authenticated user.
   */
  async getOwnerAlbums({ userId, page = 1, limit = 20 }) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const [albums, total] = await Promise.all([
      Album.find({ ownerId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
      Album.countDocuments({ ownerId: userId }),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 1;

    return {
      albums,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single Album owned by authenticated user with ordered items.
   */
  async getAlbumById({ albumId, userId }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to access this album');
      err.statusCode = 403;
      throw err;
    }

    const rawItems = await AlbumItem.find({ albumId })
      .sort({ position: 1 })
      .populate({
        path: 'voiceNoteId',
        populate: { path: 'ownerId', select: 'username' },
      });

    const items = rawItems
      .filter((item) => item.voiceNoteId)
      .map((item) => ({
        id: item._id.toString(),
        position: item.position,
        voiceNote: formatVoiceNote(item.voiceNoteId),
      }));

    return {
      album,
      items,
    };
  }

  /**
   * Update metadata of an Album owned by authenticated user.
   */
  async updateAlbum({ albumId, userId, title, description, coverImage }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to update this album');
      err.statusCode = 403;
      throw err;
    }

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        const err = new Error('Title cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      if (title.trim().length > 100) {
        const err = new Error('Title cannot exceed 100 characters');
        err.statusCode = 400;
        throw err;
      }
      album.title = title.trim();
    }

    if (description !== undefined) {
      if (description && description.trim().length > 1000) {
        const err = new Error('Description cannot exceed 1000 characters');
        err.statusCode = 400;
        throw err;
      }
      album.description = description ? description.trim() : '';
    }

    if (coverImage !== undefined) {
      album.coverImage = coverImage ? coverImage.trim() : null;
    }

    await album.save();
    return album;
  }

  /**
   * Delete an Album owned by authenticated user and clean up AlbumItem records.
   * Does NOT delete underlying VoiceNote documents or audio files on disk.
   */
  async deleteAlbum({ albumId, userId }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to delete this album');
      err.statusCode = 403;
      throw err;
    }

    // Delete AlbumItem relationships only
    await AlbumItem.deleteMany({ albumId });

    // Delete Album document
    await Album.findByIdAndDelete(albumId);

    return true;
  }

  /**
   * Add a VoiceNote to an Album owned by authenticated user.
   * Enforces canAccessVoiceNote authorization and auto-assigns position.
   */
  async addAlbumItem({ albumId, userId, user, voiceNoteId }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to modify this album');
      err.statusCode = 403;
      throw err;
    }

    const voiceNote = await VoiceNote.findById(voiceNoteId);
    if (!voiceNote) {
      const err = new Error('Voice note not found');
      err.statusCode = 404;
      throw err;
    }

    // Enforce Phase 4 VoiceNote authorization
    const access = voiceNoteService.canAccessVoiceNote(user, voiceNote);
    if (!access.allowed) {
      const err = new Error(access.message);
      err.statusCode = access.statusCode;
      throw err;
    }

    const existingItem = await AlbumItem.exists({ albumId, voiceNoteId });
    if (existingItem) {
      const err = new Error('Voice note already exists in this album');
      err.statusCode = 400;
      throw err;
    }

    const maxItem = await AlbumItem.findOne({ albumId }).sort({ position: -1 });
    let nextPosition = maxItem ? maxItem.position + 1 : 1;

    let albumItem;
    try {
      albumItem = await AlbumItem.create({
        albumId,
        voiceNoteId,
        position: nextPosition,
      });
    } catch (err) {
      if (err.code === 11000 && err.keyPattern?.position) {
        // Retry position assignment if concurrent addition occurred
        nextPosition += 1;
        albumItem = await AlbumItem.create({
          albumId,
          voiceNoteId,
          position: nextPosition,
        });
      } else {
        throw err;
      }
    }

    return albumItem;
  }

  /**
   * Remove an AlbumItem from an Album owned by authenticated user.
   * Does NOT delete underlying VoiceNote document or audio file.
   */
  async removeAlbumItem({ albumId, itemId, userId }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to modify this album');
      err.statusCode = 403;
      throw err;
    }

    const albumItem = await AlbumItem.findOne({ _id: itemId, albumId });
    if (!albumItem) {
      const err = new Error('Album item not found');
      err.statusCode = 404;
      throw err;
    }

    await AlbumItem.findByIdAndDelete(itemId);
    return true;
  }

  /**
   * Reorder AlbumItems in an Album owned by authenticated user.
   * Uses two-phase atomic update (negative temporary positions -> final positions)
   * to satisfy compound unique index { albumId: 1, position: 1 } without collisions.
   */
  async reorderAlbumItems({ albumId, userId, items }) {
    const album = await Album.findById(albumId);
    if (!album) {
      const err = new Error('Album not found');
      err.statusCode = 404;
      throw err;
    }

    if (album.ownerId.toString() !== userId.toString()) {
      const err = new Error('Access denied: You do not have permission to reorder this album');
      err.statusCode = 403;
      throw err;
    }

    if (!Array.isArray(items) || items.length === 0) {
      const err = new Error('Reorder items payload must be a non-empty array');
      err.statusCode = 400;
      throw err;
    }

    const existingAlbumItems = await AlbumItem.find({ albumId });
    if (existingAlbumItems.length !== items.length) {
      const err = new Error('Reorder payload must include all album items');
      err.statusCode = 400;
      throw err;
    }

    const existingIdsSet = new Set(existingAlbumItems.map((i) => i._id.toString()));
    const positionsSet = new Set();

    for (const item of items) {
      if (!item.itemId || !existingIdsSet.has(item.itemId)) {
        const err = new Error('Invalid album item ID or item belongs to another album');
        err.statusCode = 400;
        throw err;
      }

      if (!Number.isInteger(item.position) || item.position < 1) {
        const err = new Error('Position must be a positive integer');
        err.statusCode = 400;
        throw err;
      }

      if (positionsSet.has(item.position)) {
        const err = new Error('Duplicate positions are not allowed');
        err.statusCode = 400;
        throw err;
      }

      positionsSet.add(item.position);
    }

    // Phase 1: Set temporary negative positions to prevent unique constraint collisions
    for (let i = 0; i < items.length; i++) {
      await AlbumItem.updateOne(
        { _id: items[i].itemId, albumId },
        { $set: { position: -1 * (i + 1) } }
      );
    }

    // Phase 2: Set final target positive positions
    for (let i = 0; i < items.length; i++) {
      await AlbumItem.updateOne(
        { _id: items[i].itemId, albumId },
        { $set: { position: items[i].position } }
      );
    }

    return true;
  }
}

module.exports = new AlbumService();
