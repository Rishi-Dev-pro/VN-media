const HealthService = require('../services/health.service');
const { sendSuccess } = require('../utils/response');

/**
 * Controller handling health check requests.
 */
const getHealth = (req, res, next) => {
  try {
    const healthData = HealthService.getHealthInfo();
    return sendSuccess(res, 'VN Platform API is running', healthData, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
};
