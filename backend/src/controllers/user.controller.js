const { sanitizeUser } = require('../services/auth.service');
const { UserService } = require('../services/user.service');
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
    const { user, stats } = await UserService.getPublicProfileByUsername(req.params.username);
    return sendSuccess(res, 'Public user profile retrieved successfully', { user, stats }, 200);
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

    return sendSuccess(res, 'Public creator voice notes retrieved successfully', {
      voiceNotes: voiceNotes.map(formatVoiceNote),
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
};
