const { getDBStatus } = require('../config/db');

/**
 * Health service to calculate server and database health parameters.
 */
class HealthService {
  static getHealthInfo() {
    const dbStatus = getDBStatus();

    return {
      status: dbStatus.isConnected ? 'ok' : 'degraded',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus,
    };
  }

  static getReadinessInfo() {
    const dbStatus = getDBStatus();
    const isReady = dbStatus.isConnected;

    return {
      status: isReady ? 'ready' : 'not_ready',
      database: isReady ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = HealthService;
