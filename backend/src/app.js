const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/env');
const requestId = require('./middleware/requestId');
const sanitizeInput = require('./middleware/sanitizeInput');
const { apiLimiter } = require('./middleware/rateLimiter');

const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Request ID Correlation Header
app.use(requestId);

// Security HTTP Headers
app.use(
  helmet({
    contentSecurityPolicy: config.isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })
);

// Bounded Request Body Parsing (100kb payload limit for JSON/URL-encoded requests)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// MongoDB Operator Injection Protection
app.use(sanitizeInput);

// Global API Rate Limiter
app.use('/api', apiLimiter);

// Liveness Probe Endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Catch 404 for undefined routes
app.use(notFoundHandler);

// Global Centralized Error Handler
app.use(errorHandler);

module.exports = app;
