const config = require('../config/env');
const { sendError } = require('../utils/response');

/**
 * Centralized error-handling middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // In development mode, provide error stack if available
  const errorDetails = config.isDevelopment ? { stack: err.stack } : undefined;

  console.error(`[Error] ${statusCode} - ${message}`);
  if (config.isDevelopment && err.stack) {
    console.error(err.stack);
  }

  return sendError(res, message, statusCode, errorDetails);
};

module.exports = errorHandler;
