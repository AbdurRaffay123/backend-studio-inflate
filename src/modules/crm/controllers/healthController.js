'use strict';

const { isReady } = require('../../../shared/config/db');

/**
 * CRM module-level readiness — surfaced through the global /health endpoint.
 */
function getCrmHealth() {
  return { ok: isReady(), db: isReady() ? 'connected' : 'disconnected' };
}

const health = (_req, res) => {
  if (!isReady()) {
    return res.status(503).json({
      status:  'unavailable',
      message: 'Database not connected',
    });
  }
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { health, getCrmHealth };
