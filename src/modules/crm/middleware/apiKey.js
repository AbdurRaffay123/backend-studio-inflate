'use strict';

const logger = require('../../../shared/utils/logger');

/**
 * CRM public API key check.
 *
 * Uses the shared API_KEY env var. If unset we WARN once per request but
 * still allow access — this matches the dev-friendly behavior the mobile
 * app expects until a key is provisioned.
 */
const apiKey = (req, res, next) => {
  const configured = process.env.API_KEY;

  if (!configured) {
    logger.warn({ path: req.path }, 'API_KEY is not set — public CRM endpoints are unprotected');
    return next();
  }

  const provided = req.headers['x-api-key'];
  if (!provided || provided !== configured) {
    return res.status(401).json({
      statusCode: 401,
      error:      'Unauthorized',
      message:    'Invalid or missing API key',
    });
  }

  next();
};

module.exports = apiKey;
