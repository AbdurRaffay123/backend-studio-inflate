'use strict';

/**
 * backend-inflate-studio — entry point.
 *
 *   node index.js
 *
 * Boots a single Express server containing the product-options Shopify
 * module and the CRM module, plus the CRM admin SPA at /admin.
 */

require('dotenv').config();

const { createApp }       = require('./src/createApp');
const { connect, disconnect } = require('./src/shared/config/db');
const { fetchData }       = require('./src/modules/apps/product-options/services/appDataService');
const { isModuleEnabled } = require('./src/shared/utils/env');
const logger              = require('./src/shared/utils/logger');

// ── Production safety guard ──────────────────────────────────────────────────
// Refuse to boot if running in production without an API_KEY configured.
// Without the key, both modules' apiKey middleware fails OPEN, which would
// expose the public endpoints to the internet. Catching this at startup is
// safer than silently serving traffic on a misconfigured deploy.
if (process.env.NODE_ENV === 'production' && !process.env.API_KEY) {
  logger.error('FATAL: API_KEY must be set when NODE_ENV=production. Refusing to start.');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;

async function start() {
  const crmEnabled            = isModuleEnabled('ENABLE_CRM');
  const productOptionsEnabled = isModuleEnabled('ENABLE_APPS_PRODUCT_OPTIONS');

  // CRM owns the database. If CRM is disabled and no MONGODB_URI is set,
  // skip the connection so product-options can run standalone.
  if (crmEnabled) {
    try {
      await connect();
    } catch (err) {
      logger.error({ err }, 'Failed to connect to MongoDB — CRM endpoints will return 503');
    }
  } else {
    logger.warn('CRM module disabled (ENABLE_CRM=false) — skipping MongoDB connection');
  }

  const app = createApp();

  if (productOptionsEnabled) {
    const pollMs = Number(process.env.POLL_INTERVAL_MS) || 30_000;
    fetchData();
    setInterval(fetchData, pollMs).unref();
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, 'backend-inflate-studio listening');
  });
}

start().catch((err) => {
  logger.error({ err }, 'Fatal: failed to start server');
  process.exit(1);
});

// Process-level signal handlers are also registered inside src/shared/config/db.js
// so the Mongoose connection is closed gracefully before the process exits.
// We keep a process-level fallback here for the case where SIGTERM arrives
// before the db module is required (e.g. early require failure).
const fallbackShutdown = (signal) => async () => {
  logger.info({ signal }, 'Process-level shutdown fallback');
  try { await disconnect(); } catch { /* db handler already ran */ }
  process.exit(0);
};
process.once('SIGTERM', fallbackShutdown('SIGTERM'));
process.once('SIGINT',  fallbackShutdown('SIGINT'));
