const { FollowService } = require('../services/follow.service');
const { sendSuccess } = require('../utils/response');

/**
 * Follow a target user.
 * POST /api/users/:id/follow
 */
const followUser = async (req, res, next) => {
  try {
    const result = await FollowService.followUser({
      followerId: req.user._id,
      targetIdentifier: req.params.id,
    });

    return sendSuccess(res, 'User followed successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Unfollow a target user.
 * DELETE /api/users/:id/follow
 */
const unfollowUser = async (req, res, next) => {
  try {
    const result = await FollowService.unfollowUser({
      followerId: req.user._id,
      targetIdentifier: req.params.id,
    });

    return sendSuccess(res, 'User unfollowed successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve follow status between authenticated user and target user.
 * GET /api/users/:id/follow-status
 */
const getFollowStatus = async (req, res, next) => {
  try {
    const result = await FollowService.getFollowStatus({
      followerId: req.user._id,
      targetIdentifier: req.params.id,
    });

    return sendSuccess(res, 'Follow status retrieved successfully', result, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve paginated list of followers for a target user.
 * GET /api/users/:id/followers
 */
const getFollowers = async (req, res, next) => {
  try {
    const { followers, pagination } = await FollowService.getFollowers({
      targetIdentifier: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Followers retrieved successfully', {
      followers,
      pagination,
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve paginated list of users followed by target user.
 * GET /api/users/:id/following
 */
const getFollowing = async (req, res, next) => {
  try {
    const { following, pagination } = await FollowService.getFollowing({
      targetIdentifier: req.params.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Following users retrieved successfully', {
      following,
      pagination,
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowers,
  getFollowing,
};
