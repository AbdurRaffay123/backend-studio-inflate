'use strict';

const logger = require('../utils/logger');

// Express 5 requires exactly 4 args for error-handling middleware
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || err.status || 500;

  logger.error(
    { err, requestId: req.requestId, method: req.method, path: req.path },
    err.message || 'Unhandled error'
  );

  res.status(status).json({
    statusCode: status,
    error:   err.name || 'InternalServerError',
    message: status === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
};

module.exports = errorHandler;
