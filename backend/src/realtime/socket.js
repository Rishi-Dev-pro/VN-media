const { Server } = require('socket.io');
const socketAuth = require('./socketAuth');

let io = null;

/**
 * Initialize Socket.IO server bound to HTTP server instance.
 *
 * @param {object} httpServer - Node.js http.Server instance
 * @returns {object} Socket.IO Server instance
 */
const initSocket = (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    cors: {
      origin: '*', // Configured for development API alignment
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    transports: ['polling', 'websocket'],
  });

  // Register Socket.IO JWT authentication middleware
  io.use(socketAuth);

  // Register connection lifecycle
  io.on('connection', (socket) => {
    const userId = socket.userId;

    if (userId) {
      // User joins dedicated user room
      const userRoom = `user:${userId}`;
      socket.join(userRoom);

      // Emit connection readiness to authenticated client
      socket.emit('connection:ready', {
        status: 'connected',
        userId,
      });
    }

    socket.on('disconnect', (reason) => {
      // Clean disconnect handling; socket rooms are automatically removed by Socket.IO
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance.
 *
 * @returns {object|null}
 */
const getIO = () => {
  return io;
};

/**
 * Close Socket.IO server instance (used during server shutdown and testing).
 */
const closeSocket = async () => {
  if (io) {
    await new Promise((resolve) => {
      io.close(() => {
        io = null;
        resolve();
      });
    });
  }
};

module.exports = {
  initSocket,
  getIO,
  closeSocket,
};
