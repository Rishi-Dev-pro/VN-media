const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vn_platform',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

// Validate critical configuration
if (!config.mongodbUri) {
  throw new Error('MONGODB_URI is not defined in environment variables.');
}

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET is not defined in environment variables.');
}

module.exports = config;
