const http = require('http');
const app = require('./app');
const config = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { initSocket, closeSocket } = require('./realtime/socket');

let server;

/**
 * Bootstrap application server:
 * 1. Connect to MongoDB.
 * 2. Start HTTP & Socket.IO listener.
 */
const startServer = async () => {
  try {
    // 1. Connect to Database first
    await connectDB();

    // 2. Wrap Express app with HTTP server and initialize Socket.IO
    server = http.createServer(app);
    initSocket(server);

    server.listen(config.port, () => {
      console.log(`[Server] VN Platform API running in ${config.env} mode on port ${config.port}`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start application: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Handle graceful shutdown of HTTP server, Socket.IO, and MongoDB connection.
 */
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);

  await closeSocket();

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
