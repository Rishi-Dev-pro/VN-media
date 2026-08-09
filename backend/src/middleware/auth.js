const User = require('../models/User');
const { verifyToken } = require('../utils/jwt');
const { sendError } = require('../utils/response');

/**
 * Authentication guard middleware.
 * Verifies JWT from Authorization Bearer header and attaches req.user.
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return sendError(res, 'Authentication required', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    if (!decoded || !decoded.sub) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    const user = await User.findById(decoded.sub);

    if (!user) {
      return sendError(res, 'User not found or access revoked', 401);
    }

    // Attach authenticated user object to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication middleware.
 * Attaches req.user if a valid JWT Bearer header is present,
 * but allows unauthenticated requests to proceed with req.user = null.
 */
const protectOptional = async (req, res, next) => {
  try {
    req.user = null;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next();
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return next();
    }

    if (!decoded || !decoded.sub) {
      return next();
    }

    const user = await User.findById(decoded.sub);
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  protectOptional,
};
