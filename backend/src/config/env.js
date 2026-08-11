const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const maxAudioFileSizeMB = parseInt(process.env.MAX_AUDIO_FILE_SIZE_MB, 10) || 10;
const parsedRetentionDays = parseInt(process.env.AUDIO_DELETED_RETENTION_DAYS, 10);
const audioDeletedRetentionDays = (!isNaN(parsedRetentionDays) && parsedRetentionDays >= 0) ? parsedRetentionDays : 7;

const parseCorsOrigins = () => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  return ['*'];
};

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  env: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/vn_platform',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: parseCorsOrigins(),
  maxAudioFileSizeMB,
  maxAudioSizeBytes: maxAudioFileSizeMB * 1024 * 1024,
  audioStoragePath: process.env.AUDIO_STORAGE_PATH || 'storage/audio',
  audioDeletedRetentionDays,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

// Validate critical configuration
if (!config.mongodbUri) {
  throw new Error('Required database configuration is missing.');
}

if (!config.jwtSecret) {
  throw new Error('Required authentication security configuration is missing.');
}

if (config.isProduction && config.jwtSecret === 'dev_jwt_secret_key_change_in_production') {
  throw new Error('Required production security configuration (JWT_SECRET) is missing or using insecure default.');
}

module.exports = config;
