const activityEventService = require('../services/activityEvent.service');
const { sendSuccess } = require('../utils/response');

/**
 * Format ActivityEvent document for client responses.
 * Strictly exposes safe event fields without raw MongoDB internals.
 */
const formatActivityEvent = (event) => ({
  id: event._id.toString(),
  type: event.type,
  targetType: event.targetType,
  targetId: event.targetId.toString(),
  metadata: event.metadata || {},
  createdAt: event.createdAt,
});

/**
 * Get paginated activity events for the authenticated user.
 * GET /api/activity/me
 */
const getMyActivityEvents = async (req, res, next) => {
  try {
    const { events, pagination } = await activityEventService.getUserActivityEvents({
      userId: req.user._id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return sendSuccess(res, 'Activity events retrieved successfully', {
      items: events.map(formatActivityEvent),
      pagination,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  formatActivityEvent,
  getMyActivityEvents,
};
