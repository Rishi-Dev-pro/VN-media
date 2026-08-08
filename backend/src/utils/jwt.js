const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * Generate a JWT signed token for an authenticated user.
 *
 * @param {string|object} userId - Database ID of the user
 * @returns {string} Signed JWT token string
 */
const generateToken = (userId) => {
  return jwt.sign(
    { sub: userId.toString() },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

/**
 * Synchronously verify a JWT token.
 *
 * @param {string} token - JWT token string to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token signature or expiration is invalid
 */
const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

module.exports = {
  generateToken,
  verifyToken,
};
