const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a JWT signed token for an authenticated user.
 *
 * @param {string|object} userId - Database ID of the user or user object
 * @param {number} [tokenVersion=0] - Session token version for revocation checks
 * @returns {string} Signed JWT token string
 */
const generateToken = (userId, tokenVersion) => {
  const idStr = userId && userId._id ? userId._id.toString() : userId.toString();
  const version = tokenVersion !== undefined
    ? tokenVersion
    : (userId && userId.tokenVersion !== undefined ? userId.tokenVersion : 0);

  const payload = {
    sub: idStr,
    tokenVersion: version,
  };

  return jwt.sign(payload, config.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn,
  });
};

/**
 * Synchronously verify a JWT token with algorithm restriction.
 *
 * @param {string} token - JWT token string to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token signature or expiration is invalid
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
};

module.exports = {
  generateToken,
  verifyToken,
};
