const mongoose = require('mongoose');
const ActivityEvent = require('../models/ActivityEvent');
const { EVENT_TYPES, TARGET_TYPES } = require('../utils/activityEvents');

class ActivityEventService {
  /**
   * Internal backend API to record an ActivityEvent.
   * Does NOT accept HTTP req/res objects directly.
   *
   * @param {object} params
   * @param {string|object} params.actorId - User ID who performed the action
   * @param {string} params.type - Event type (must be in EVENT_TYPES)
   * @param {string} params.targetType - Target type (must be in TARGET_TYPES)
   * @param {string|object} params.targetId - Target entity ID
   * @param {object} [params.metadata={}] - Optional structured metadata
   * @returns {Promise<object>} Created ActivityEvent document
   */
  async createActivityEvent({ actorId, type, targetType, targetId, metadata = {} }) {
    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId.toString())) {
      const err = new Error('Valid actorId is required');
      err.statusCode = 400;
      throw err;
    }

    if (!type || !Object.values(EVENT_TYPES).includes(type)) {
      const err = new Error(`Invalid event type: ${type}`);
      err.statusCode = 400;
      throw err;
    }

    if (!targetType || !Object.values(TARGET_TYPES).includes(targetType)) {
      const err = new Error(`Invalid target type: ${targetType}`);
      err.statusCode = 400;
      throw err;
    }

    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId.toString())) {
      const err = new Error('Valid targetId is required');
      err.statusCode = 400;
      throw err;
    }

    const event = await ActivityEvent.create({
      actorId,
      type,
      targetType,
      targetId,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
    });

    return event;
  }

  /**
   * Retrieve paginated activity events for the authenticated user (actorId = userId).
   *
   * @param {object} params
   * @param {string|object} params.userId - Authenticated user ID
   * @param {number|string} [params.page=1] - Requested page number
   * @param {number|string} [params.limit=20] - Requested limit per page
   * @returns {Promise<{ events: Array, pagination: object }>}
   */
  async getUserActivityEvents({ userId, page = 1, limit = 20 }) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
      const err = new Error('Authentication required');
      err.statusCode = 401;
      throw err;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    const query = { actorId: userId };

    const [events, total] = await Promise.all([
      ActivityEvent.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(parsedLimit),
      ActivityEvent.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / parsedLimit) || 0;

    return {
      events,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
      },
    };
  }
}

module.exports = new ActivityEventService();
