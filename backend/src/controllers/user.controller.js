const { sanitizeUser } = require('../services/auth.service');
const { UserService } = require('../services/user.service');
const engagementService = require('../services/engagement.service');
const { formatVoiceNote } = require('./voiceNote.controller');
const { sendSuccess } = require('../utils/response');

/**
 * Controller retrieving current authenticated user's profile.
 * GET /api/users/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = sanitizeUser(req.user);
    return sendSuccess(res, 'Authenticated user retrieved successfully', { user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller updating current authenticated user's profile.
 * PATCH /api/users/me
 */
const updateMe = async (req, res, next) => {
  try {
    const { username, avatar, bio } = req.body;
    const user = await UserService.updateUserProfile(req.user._id, { username, avatar, bio });
    return sendSuccess(res, 'Profile updated successfully', { user }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller retrieving a user's public profile and statistics by username.
 * GET /api/users/:username
 */
const getPublicProfile = async (req, res, next) => {
  try {
    const profileData = await UserService.getPublicProfileByUsername(req.params.username, req.user);
    return sendSuccess(res, 'Public user profile retrieved successfully', profileData, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller retrieving a creator's public VoiceNotes by username.
 * GET /api/users/:username/voice-notes
 */
const getPublicUserVoiceNotes = async (req, res, next) => {
  try {
    const { voiceNotes, pagination } = await UserService.getPublicUserVoiceNotes({
      username: req.params.username,
      page: req.query.page,
      limit: req.query.limit,
    });

    const formatted = voiceNotes.map(formatVoiceNote);
    const enriched = await engagementService.enrichVoiceNotesWithEngagement(formatted, req.user);

    return sendSuccess(res, 'Public creator voice notes retrieved successfully', {
      voiceNotes: enriched,
      pagination,
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller retrieving a creator's public Albums by username.
 * GET /api/users/:username/albums
 */
const getPublicUserAlbums = async (req, res, next) => {
  try {
    const albumService = require('../services/album.service');
    const { formatAlbum } = require('./album.controller');

    const { albums, pagination } = await albumService.getPublicUserAlbums({
      username: req.params.username,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Public creator albums retrieved successfully', {
      albums: albums.map(formatAlbum),
      pagination,
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMe,
  updateMe,
  getPublicProfile,
  getPublicUserVoiceNotes,
  getPublicUserAlbums,
};
