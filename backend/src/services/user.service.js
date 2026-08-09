const User = require('../models/User');
const VoiceNote = require('../models/VoiceNote');
const { sanitizeUser } = require('./auth.service');

/**
 * Format a User document into a safe public profile JSON object.
 * Strictly excludes email and passwordHash.
 *
 * @param {object} user - Mongoose User document
 * @returns {object} Safe public user profile representation
 */
const sanitizePublicUser = (user) => {
  if (!user) return null;
  return {
    id: user._id.toString(),
    username: user.username,
    avatar: user.avatar || null,
    bio: user.bio || '',
    createdAt: user.createdAt,
  };
};

class UserService {
  /**
   * Get public profile representation and statistics of a user by username.
   *
   * @param {string} username - Target username
   * @param {object|null} [requestingUser=null] - Optional requesting user object
   * @returns {Promise<{ user: object, stats: { publicVoiceNotes: number, followers: number, following: number }, relationship?: { isFollowing: boolean } }>}
   */
  static async getPublicProfileByUsername(username, requestingUser = null) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      const err = new Error('Username parameter is required');
      err.statusCode = 400;
      throw err;
    }

    const escapedUsername = username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ username: new RegExp(`^${escapedUsername}$`, 'i') });

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const Follow = require('../models/Follow');

    // Privacy Invariant: Count ONLY public VoiceNotes, plus followers and following counts
    const [publicVoiceNotes, followersCount, followingCount] = await Promise.all([
      VoiceNote.countDocuments({ ownerId: user._id, visibility: 'public' }),
      Follow.countDocuments({ followingId: user._id }),
      Follow.countDocuments({ followerId: user._id }),
    ]);

    const profileData = {
      user: sanitizePublicUser(user),
      stats: {
        publicVoiceNotes,
        followers: followersCount,
        following: followingCount,
      },
    };

    if (requestingUser && requestingUser._id) {
      if (requestingUser._id.toString() === user._id.toString()) {
        profileData.relationship = { isFollowing: false };
      } else {
        const isFollowing = await Follow.exists({
          followerId: requestingUser._id,
          followingId: user._id,
        });
        profileData.relationship = { isFollowing: !!isFollowing };
      }
    }

    return profileData;
  }

  /**
   * Get paginated public VoiceNotes owned by a creator by username.
   *
   * @param {object} params
   * @param {string} params.username - Target creator's username
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   */
  static async getPublicUserVoiceNotes({ username, page = 1, limit = 20 }) {
    if (!username || typeof username !== 'string' || !username.trim()) {
      const err = new Error('Username parameter is required');
      err.statusCode = 400;
      throw err;
    }

    const escapedUsername = username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const user = await User.findOne({ username: new RegExp(`^${escapedUsername}$`, 'i') });

    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    // Privacy Invariant: Query ONLY public VoiceNotes owned by this user
    const query = { ownerId: user._id, visibility: 'public' };

    const [voiceNotes, total] = await Promise.all([
      VoiceNote.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('ownerId', 'username'),
      VoiceNote.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

    return {
      voiceNotes,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

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

module.exports = {
  UserService,
  sanitizePublicUser,
};
