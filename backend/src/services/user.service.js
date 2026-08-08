const User = require('../models/User');
const { sanitizeUser } = require('./auth.service');

class UserService {
  /**
   * Get public profile representation of a user by ID.
   */
  static async getUserProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return sanitizeUser(user);
  }

  /**
   * Update allowed profile fields for an authenticated user.
   */
  static async updateUserProfile(userId, updates) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const { username, avatar, bio } = updates;

    // Handle username update
    if (username !== undefined && username !== null) {
      const normalizedUsername = username.trim();
      if (normalizedUsername !== user.username) {
        if (normalizedUsername.length < 3 || normalizedUsername.length > 30) {
          const err = new Error('Username must be between 3 and 30 characters long');
          err.statusCode = 400;
          throw err;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
          const err = new Error('Username can only contain letters, numbers, and underscores');
          err.statusCode = 400;
          throw err;
        }

        const existingUsername = await User.findOne({ username: normalizedUsername });
        if (existingUsername) {
          const err = new Error('Username is already taken');
          err.statusCode = 400;
          throw err;
        }

        user.username = normalizedUsername;
      }
    }

    // Handle avatar update
    if (avatar !== undefined) {
      user.avatar = avatar !== null ? String(avatar).trim() : null;
    }

    // Handle bio update
    if (bio !== undefined && bio !== null) {
      const trimmedBio = String(bio).trim();
      if (trimmedBio.length > 500) {
        const err = new Error('Bio cannot exceed 500 characters');
        err.statusCode = 400;
        throw err;
      }
      user.bio = trimmedBio;
    }

    await user.save();
    return sanitizeUser(user);
  }
}

module.exports = UserService;
