'use strict';

const { getAppData, getLastFetchedAt } = require('../services/appDataService');

/**
 * Module-specific liveness probe — reports whether the remote app data
 * has been loaded into memory yet. Used by the global /health endpoint.
 */
function getProductOptionsHealth() {
  const app_data    = getAppData();
  const lastFetched = getLastFetchedAt();
  const configsLoaded = app_data?.configs?.length ?? 0;
  const ok = configsLoaded > 0;

  return {
    ok,
    configsLoaded,
    lastFetched,
  };
}

function getHealth(_req, res) {
  const status = getProductOptionsHealth();
  if (!status.ok) {
    return res.status(503).json({ status: 'error', ...status });
  }
  return res.json({ status: 'ok', ...status });
}

module.exports = { getHealth, getProductOptionsHealth };
