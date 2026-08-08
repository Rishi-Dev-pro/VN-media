const { sendError } = require('../utils/response');

/**
 * Middleware to handle unmatched API endpoints (404 Not Found).
 */
const notFoundHandler = (req, res, next) => {
  return sendError(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    404
  );
};

module.exports = notFoundHandler;
