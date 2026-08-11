const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');

/**
 * Socket.IO JWT authentication middleware.
 * Verifies JWT token from handshake auth or headers and attaches socket.userId.
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {function} next - Middleware next callback
 */
const socketAuth = async (socket, next) => {
  try {
    const auth = socket.handshake.auth || {};
    const headers = socket.handshake.headers || {};

    let token = auth.token || headers.authorization;

    if (!token) {
      const err = new Error('Authentication required');
      err.data = { statusCode: 401 };
      return next(err);
    }

    if (token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    if (!token) {
      const err = new Error('Authentication required');
      err.data = { statusCode: 401 };
      return next(err);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      const err = new Error('Invalid or expired token');
      err.data = { statusCode: 401 };
      return next(err);
    }

    if (!decoded || !decoded.sub) {
      const err = new Error('Invalid or expired token');
      err.data = { statusCode: 401 };
      return next(err);
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      const err = new Error('User not found or access revoked');
      err.data = { statusCode: 401 };
      return next(err);
    }

    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        const err = new Error('User not found or access revoked');
        err.data = { statusCode: 401 };
        return next(err);
      }
    }

    // Attach authenticated user ID to socket instance
    socket.userId = user._id.toString();
    next();
  } catch (error) {
    const err = new Error('Authentication failed');
    err.data = { statusCode: 401 };
    next(err);
  }
};

module.exports = socketAuth;
