'use strict';

/**
 * Optional JSON HTTP access logs, enabled via `LOG_JSON`.
 *
 * Lazy-loaded so disabling the feature costs nothing in tests.
 * Auth-bearing headers are redacted to avoid leaking secrets into logs.
 */

const TRUTHY_FLAG_VALUES = new Set(['1', 'true', 'yes', 'on']);
const VALID_LOG_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']);
const IGNORED_PATHS = new Set(['/health']);

function isFeatureEnabled() {
  const raw = process.env.LOG_JSON;
  if (!raw) return false;
  return TRUTHY_FLAG_VALUES.has(raw.trim().toLowerCase());
}

function resolveLogLevel() {
  const raw = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return VALID_LOG_LEVELS.has(raw) ? raw : 'info';
}

function pathOf(url) {
  if (!url) return '';
  const q = url.indexOf('?');
  return q === -1 ? url : url.slice(0, q);
}

function shouldIgnore(req) {
  return IGNORED_PATHS.has(pathOf(req.url));
}

let cachedLogger = null;
let cachedMiddleware = null;

function buildMiddleware() {
  if (cachedMiddleware) return cachedMiddleware;

  const pino     = require('pino');
  const pinoHttp = require('pino-http');

  cachedLogger =
    cachedLogger ||
    pino({
      level: resolveLogLevel(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-api-key"]',
          'req.headers["x-agent-key"]',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
    });

  cachedMiddleware = pinoHttp({
    logger: cachedLogger,
    customProps: (req) => ({ requestId: req.id }),
    autoLogging: { ignore: shouldIgnore },
  });

  return cachedMiddleware;
}

function attachHttpLogger(app) {
  if (!isFeatureEnabled()) return;
  app.use(buildMiddleware());
}

module.exports = { attachHttpLogger };
