'use strict';

/**
 * Backward-compatibility router for inflate-studio-product-options.
 *
 * The existing mobile app currently calls:
 *   GET  /              (product config lookup)
 *   POST /api/upload    (S3 image upload)
 *   GET  /test          (diagnostic — agent only)
 *
 * To avoid forcing every storefront / mobile build to update its env
 * variables, those exact paths are also exposed at the server root.
 *
 * The canonical, namespaced paths live under
 *   /api/apps/product-options/...
 * and should be preferred for new integrations.
 */

const express   = require('express');
const rateLimit = require('express-rate-limit');

const { getProductConfig, testEndpoint } = require('../controllers/productController');
const { handleMulterUpload }             = require('../controllers/uploadController');
const { apiKeyMiddleware }               = require('../middleware/apiKey');
const { agentKeyMiddleware }             = require('../middleware/agentKey');

const router = express.Router();

const uploadLimitMaxRaw = Number(process.env.UPLOAD_RATE_LIMIT_MAX);
const uploadLimitMax    = Number.isFinite(uploadLimitMaxRaw) && uploadLimitMaxRaw > 0
  ? uploadLimitMaxRaw
  : 20;

const lookupLimitMaxRaw = Number(process.env.LOOKUP_RATE_LIMIT_MAX);
const lookupLimitMax    = Number.isFinite(lookupLimitMaxRaw) && lookupLimitMaxRaw > 0
  ? lookupLimitMaxRaw
  : 60;

const productLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: lookupLimitMax,
  standardHeaders: true,
  legacyHeaders:   false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: uploadLimitMax,
  standardHeaders: true,
  legacyHeaders:   false,
});

router.get('/test',         agentKeyMiddleware, testEndpoint);
router.get('/',             apiKeyMiddleware, productLookupLimiter, getProductConfig);
router.post('/api/upload',  apiKeyMiddleware, uploadLimiter,        handleMulterUpload);

module.exports = router;
