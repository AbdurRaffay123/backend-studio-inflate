'use strict';

/**
 * Root Express application factory for backend-inflate-studio.
 *
 * Modular monolith — one Express server, two feature modules:
 *
 *   /api/apps/product-options/*     Shopify product options module
 *   /api/crm/*                      CRM module (consultations + customers)
 *   /admin/*                        CRM admin SPA (static)
 *   /health                         Aggregate readiness probe
 *
 * Backward compatibility:
 *   The legacy product-options paths (`/`, `/api/upload`, `/test`) are also
 *   exposed at the server root so existing storefront / mobile builds keep
 *   working without env changes.
 */

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const path      = require('path');
const bodyParser = require('body-parser');

const requestId          = require('./shared/middleware/requestId');
const errorHandler       = require('./shared/middleware/errorHandler');
const { attachHttpLogger } = require('./shared/middleware/httpLogger');
const logger             = require('./shared/utils/logger');
const { isModuleEnabled } = require('./shared/utils/env');

// Module routers
const productOptionsRouter        = require('./modules/apps/product-options/routes');
const productOptionsLegacyRouter  = require('./modules/apps/product-options/routes/legacy');
const { getProductOptionsHealth } = require('./modules/apps/product-options/controllers/healthController');

const crmRouter        = require('./modules/crm/routes');
const { getCrmHealth } = require('./modules/crm/controllers/healthController');

const buildCorsOrigin = () => {
  const raw = process.env.ALLOWED_ORIGINS;
  if (!raw || !raw.trim()) {
    // Open in development; explicit allow-list required in production
    return process.env.NODE_ENV === 'production' ? false : true;
  }
  const allowed = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return (origin, cb) => {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    logger.warn({ origin }, 'CORS rejected');
    cb(new Error(`Origin ${origin} not allowed`));
  };
};

function createApp() {
  const app = express();

  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY);
  }

  app.use(requestId);
  app.use(helmet({
    // CSP is disabled because the admin SPA uses inline scripts/styles
    contentSecurityPolicy: false,
  }));
  attachHttpLogger(app);

  app.use(cors({
    origin:      buildCorsOrigin(),
    credentials: true,
  }));

  app.use(bodyParser.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // ── Static admin SPA (CRM) ─────────────────────────────────────────────────
  const crmEnabled            = isModuleEnabled('ENABLE_CRM');
  const productOptionsEnabled = isModuleEnabled('ENABLE_APPS_PRODUCT_OPTIONS');

  if (crmEnabled) {
    app.use('/admin', express.static(path.join(__dirname, 'modules/crm/admin')));
  }

  // ── Aggregate health endpoint ──────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    const modules = {};
    let allOk = true;

    if (productOptionsEnabled) {
      modules['apps.product-options'] = getProductOptionsHealth();
      if (!modules['apps.product-options'].ok) allOk = false;
    }
    if (crmEnabled) {
      modules['crm'] = getCrmHealth();
      if (!modules['crm'].ok) allOk = false;
    }

    const body = {
      status:    allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      modules,
    };
    res.status(allOk ? 200 : 503).json(body);
  });

  // ── Module mounts ──────────────────────────────────────────────────────────
  if (productOptionsEnabled) {
    app.use('/api/apps/product-options', productOptionsRouter);
    // Backward-compat: keep the original storefront/mobile paths working
    app.use('/', productOptionsLegacyRouter);
    logger.info('Module enabled: apps.product-options (mounted at /api/apps/product-options + legacy)');
  }

  if (crmEnabled) {
    app.use('/api/crm', crmRouter);
    logger.info('Module enabled: crm (mounted at /api/crm, admin SPA at /admin)');
  }

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
