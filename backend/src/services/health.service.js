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
}

module.exports = HealthService;
