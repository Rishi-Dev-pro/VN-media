const config = require('../config/env');
const { sendError } = require('../utils/response');

/**
 * Centralized error-handling middleware.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose duplicate key errors (E11000) as 409 Conflict
  if (err.code === 11000) {
    statusCode = 409;
    const keys = err.keyValue ? Object.keys(err.keyValue).join(', ') : 'field';
    message = `Duplicate resource entry: ${keys} already exists`;
  }

  // Handle Mongoose validation errors as 400 Bad Request
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const firstField = Object.keys(err.errors)[0];
    message = err.errors[firstField]?.message || 'Invalid input data';
  }

  // Handle Mongoose invalid ObjectId errors as 400 Bad Request
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource identifier.';
  }

  // In production mode, sanitize 500 error messages to prevent details/path leakage
  if (config.isProduction && statusCode >= 500) {
    message = 'Internal Server Error';
  }

  // In development mode, provide error stack for 5xx server errors
  const errorDetails = config.isDevelopment && statusCode >= 500 ? { stack: err.stack } : undefined;

  // Log 5xx errors or operational 4xx errors cleanly
  if (statusCode >= 500) {
    console.error(`[Server Error] ${statusCode} - ${err.message || message}`);
    if (config.isDevelopment && err.stack) {
      console.error(err.stack);
    }
  } else {
    console.warn(`[Client Warning] ${statusCode} - ${message}`);
  }

  return sendError(res, message, statusCode, errorDetails);
};

module.exports = errorHandler;
