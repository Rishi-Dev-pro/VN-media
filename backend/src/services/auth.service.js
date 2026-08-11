const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * Format a User document into a safe public JSON object (stripping passwordHash).
 *
 * @param {object} user - Mongoose User document or plain object
 * @returns {object} Safe user representation
 */
const sanitizeUser = (user) => {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

class AuthService {
  /**
   * Register a new user account.
   */
  static async registerUser({ username, email, password }) {
    if (!username || !email || !password) {
      const err = new Error('Username, email, and password are required');
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 6) {
      const err = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      const err = new Error('Please provide a valid email address');
      err.statusCode = 400;
      throw err;
    }

    // Check for existing username
    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      const err = new Error('Username is already taken');
      err.statusCode = 400;
      throw err;
    }

    // Check for existing email
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      const err = new Error('Email is already registered');
      err.statusCode = 400;
      throw err;
    }

    // Hash password with bcrypt cost factor 10
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
    });

    return sanitizeUser(user);
  }

  /**
   * Authenticate a user and issue a JWT token.
   */
  static async loginUser({ email, password }) {
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      const err = new Error('Email and password must be valid strings');
      err.statusCode = 400;
      throw err;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user by normalized email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Compare supplied password with stored bcrypt hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Issue JWT token with current user tokenVersion
    const token = generateToken(user._id, user.tokenVersion || 0);

    return {
      token,
      user: sanitizeUser(user),
    };
  }

  /**
   * Revoke all active sessions for a user by incrementing tokenVersion.
   */
  static async revokeAllSessions(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    return true;
  }
}

module.exports = {
  AuthService,
  sanitizeUser,
};
