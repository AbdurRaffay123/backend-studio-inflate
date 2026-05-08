'use strict';

/**
 * Storefront API key check.
 * Uses the shared API_KEY env var. If unset, requests are allowed
 * through (development convenience) — same fail-open behavior as before.
 */
function apiKeyMiddleware(req, res, next) {
  const expected = (process.env.API_KEY || '').trim();
  if (!expected) {
    return next();
  }
  const sent = (req.headers['x-api-key'] || '').trim();
  if (sent !== expected) {
    return res.status(401).json({
      error:   'Unauthorized',
      message: 'Invalid or missing API key',
    });
  }
  next();
}

module.exports = { apiKeyMiddleware };
