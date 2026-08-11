/**
 * Production-ready in-memory sliding window rate limiter middleware.
 * Outputs X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and Retry-After headers.
 */
class MemoryRateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 100, message = 'Too many requests, please try again later') {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.message = message;
    this.hits = new Map();

    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (record.resetTime <= now) {
        this.hits.delete(key);
      }
    }
  }

  getMiddleware() {
    return (req, res, next) => {
      const now = Date.now();
      const ip = req.ip || req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
      const key = `${ip}:${req.path}`;

      let record = this.hits.get(key);
      if (!record || record.resetTime <= now) {
        record = { count: 0, resetTime: now + this.windowMs };
        this.hits.set(key, record);
      }

      record.count++;

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetSeconds);

      if (record.count > this.maxRequests) {
        res.setHeader('Retry-After', resetSeconds);
        return res.status(429).json({
          success: false,
          error: {
            message: this.message,
            statusCode: 429,
          },
        });
      }

      next();
    };
  }
}

// Preset rate limiters tailored by endpoint sensitivity
const authLimiter = new MemoryRateLimiter(15 * 60 * 1000, 10, 'Too many authentication attempts, please try again later.').getMiddleware();
const apiLimiter = new MemoryRateLimiter(15 * 60 * 1000, 300, 'Too many requests, please slow down.').getMiddleware();
const searchLimiter = new MemoryRateLimiter(60 * 1000, 30, 'Too many search requests, please slow down.').getMiddleware();
const uploadLimiter = new MemoryRateLimiter(15 * 60 * 1000, 15, 'Too many upload attempts, please try again later.').getMiddleware();
const downloadLimiter = new MemoryRateLimiter(15 * 60 * 1000, 60, 'Too many download requests, please try again later.').getMiddleware();

module.exports = {
  MemoryRateLimiter,
  authLimiter,
  apiLimiter,
  searchLimiter,
  uploadLimiter,
  downloadLimiter,
};
