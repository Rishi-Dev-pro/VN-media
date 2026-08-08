const { sanitizeUser } = require('../services/auth.service');
const UserService = require('../services/user.service');
const { sendSuccess } = require('../utils/response');

/**
 * Controller retrieving current authenticated user's profile.
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

module.exports = {
  getMe,
  updateMe,
};
