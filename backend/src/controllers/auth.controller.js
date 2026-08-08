const { AuthService } = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');

/**
 * Controller handling user registration.
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const user = await AuthService.registerUser({ username, email, password });
    return sendSuccess(res, 'User registered successfully', { user }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller handling user authentication (login).
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.loginUser({ email, password });
    return sendSuccess(res, 'Login successful', result, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
};
