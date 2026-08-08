/**
 * Send a standardized success JSON response.
 *
 * @param {object} res - Express response object
 * @param {string} message - Human-readable success message
 * @param {any} [data=null] - Optional response payload
 * @param {number} [statusCode=200] - HTTP status code
 */
const sendSuccess = (res, message, data = null, statusCode = 200) => {
  const responsePayload = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    responsePayload.data = data;
  }

  return res.status(statusCode).json(responsePayload);
};

/**
 * Send a standardized error JSON response.
 *
 * @param {object} res - Express response object
 * @param {string} message - Error description
 * @param {number} [statusCode=500] - HTTP status code
 * @param {any} [errorDetails=null] - Optional error details (only included if provided)
 */
const sendError = (res, message, statusCode = 500, errorDetails = null) => {
  const responsePayload = {
    success: false,
    message,
  };

  if (errorDetails !== null && errorDetails !== undefined) {
    responsePayload.error = errorDetails;
  }

  return res.status(statusCode).json(responsePayload);
};

module.exports = {
  sendSuccess,
  sendError,
};
