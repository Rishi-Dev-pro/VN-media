const crypto = require('crypto');

/**
 * Middleware to generate or sanitize X-Request-ID header for request correlation across logs and HTTP responses.
 */
const requestId = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const sanitizedId = incomingId && typeof incomingId === 'string'
    ? incomingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
    : '';

  const id = sanitizedId || (crypto.randomUUID ? crypto.randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
};

module.exports = requestId;
