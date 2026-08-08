const config = require('../config/env');
const { sendError } = require('../utils/response');

/**
 * Centralized error-handling middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose validation errors as 400 Bad Request
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const firstField = Object.keys(err.errors)[0];
    message = err.errors[firstField]?.message || 'Invalid input data';
  }

  // Handle Mongoose invalid ObjectId errors as 400 Bad Request
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // In development mode, provide error stack for 5xx server errors
  const errorDetails = config.isDevelopment && statusCode >= 500 ? { stack: err.stack } : undefined;

  // Log 5xx errors or operational 4xx errors cleanly
  if (statusCode >= 500) {
    console.error(`[Server Error] ${statusCode} - ${message}`);
    if (config.isDevelopment && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.warn(`[Client Warning] ${statusCode} - ${message}`);
  }

  return sendError(res, message, statusCode, errorDetails);
};

module.exports = errorHandler;
