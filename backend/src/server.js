const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

let server;

/**
 * Bootstrap application server:
 * 1. Connect to MongoDB.
 * 2. Start HTTP listener.
 */
const startServer = async () => {
  try {
    // 1. Connect to Database first
    await connectDB();

    // 2. Start HTTP Server only after successful DB connection
    server = app.listen(config.port, () => {
      console.log(`[Server] VN Platform API running in ${config.env} mode on port ${config.port}`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start application: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Handle graceful shutdown of HTTP server and MongoDB connection.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
