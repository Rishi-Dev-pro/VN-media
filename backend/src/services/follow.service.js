const mongoose = require('mongoose');
const Follow = require('../models/Follow');
const User = require('../models/User');
const { sanitizePublicUser } = require('./user.service');

/**
 * Resolve target User document by ObjectId or username.
 * Throws 404 Not Found if user does not exist.
 *
 * @param {string} identifier - User ID or username
 * @returns {Promise<object>} Mongoose User document
 */
const resolveUser = async (identifier) => {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    const err = new Error('User identifier is required');
    err.statusCode = 400;
    throw err;
  }

  const trimmed = identifier.trim();
  let user = null;

  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    user = await User.findById(trimmed);
  }

  if (!user) {
    const escaped = trimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    user = await User.findOne({ username: new RegExp(`^${escaped}$`, 'i') });
  }

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return user;
};

class FollowService {
  /**
   * Follow a target user (Idempotent).
   */
  static async followUser({ followerId, targetIdentifier }) {
    const targetUser = await resolveUser(targetIdentifier);

    if (followerId.toString() === targetUser._id.toString()) {
      const err = new Error('You cannot follow yourself');
      err.statusCode = 400;
      throw err;
    }

    try {
      await Follow.create({
        followerId,
        followingId: targetUser._id,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Idempotent duplicate follow handling
      } else {
        throw err;
      }
    }

    return { following: true };
  }

  /**
   * Unfollow a target user (Idempotent).
   */
  static async unfollowUser({ followerId, targetIdentifier }) {
    const targetUser = await resolveUser(targetIdentifier);

    await Follow.deleteOne({
      followerId,
      followingId: targetUser._id,
    });

    return { following: false };
  }

  /**
   * Check if authenticated user follows target user.
   */
  static async getFollowStatus({ followerId, targetIdentifier }) {
    const targetUser = await resolveUser(targetIdentifier);

    if (followerId.toString() === targetUser._id.toString()) {
      return { following: false };
    }

    const followExists = await Follow.exists({
      followerId,
      followingId: targetUser._id,
    });

    return { following: !!followExists };
  }

  /**
   * Get paginated list of users who follow target user.
   */
  static async getFollowers({ targetIdentifier, page = 1, limit = 20 }) {
    const targetUser = await resolveUser(targetIdentifier);

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { followingId: targetUser._id };

    const [follows, total] = await Promise.all([
      Follow.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('followerId'),
      Follow.countDocuments(query),
    ]);

    const followers = follows
      .map((f) => sanitizePublicUser(f.followerId))
      .filter(Boolean);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

    return {
      followers,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get paginated list of users followed by target user.
   */
  static async getFollowing({ targetIdentifier, page = 1, limit = 20 }) {
    const targetUser = await resolveUser(targetIdentifier);

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { followerId: targetUser._id };

    const [follows, total] = await Promise.all([
      Follow.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .populate('followingId'),
      Follow.countDocuments(query),
    ]);

    const following = follows
      .map((f) => sanitizePublicUser(f.followingId))
      .filter(Boolean);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

    return {
      following,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }
}

module.exports = {
  FollowService,
  resolveUser,
};
