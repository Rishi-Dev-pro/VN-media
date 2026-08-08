const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const apiRoutes = require('./routes');
const notFoundHandler = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Configured for development; restrict in production as needed
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes under /api
app.use('/api', apiRoutes);

// Catch 404 for undefined routes
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
