const mongoose = require('mongoose');
const config = require('./env');

/**
 * Connect to MongoDB instance using Mongoose.
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      // Modern Mongoose defaults are optimal for MongoDB 6+ / 8+
    });

    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host} / Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection Error: ${error.message}`);
    throw error;
  }
};

/**
 * Close MongoDB connection gracefully.
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed gracefully');
  } catch (error) {
    console.error(`[MongoDB] Disconnect Error: ${error.message}`);
  }
};

/**
 * Get current database connection state.
 * @returns {object} Status details
 */
const getDBStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const stateCode = mongoose.connection.readyState;
  return {
    state: states[stateCode] || 'unknown',
    isConnected: stateCode === 1,
    host: mongoose.connection.host || null,
    name: mongoose.connection.name || null,
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  getDBStatus,
};
