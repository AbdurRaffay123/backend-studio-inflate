'use strict';

/**
 * Product Options module router.
 *
 * Mounted at `/api/apps/product-options` by the root createApp.
 * Public routes:
 *   GET   /         → product config lookup (apiKey + rate limit)
 *   POST  /upload   → S3 image upload       (apiKey + rate limit)
 *   GET   /health   → module readiness
 *   GET   /test     → diagnostic            (agent key only)
 *
 * The legacy paths (`/`, `/api/upload`, `/test`) are also exposed at the
 * server root for backward compatibility — see createApp.js.
 */

const express   = require('express');
const rateLimit = require('express-rate-limit');

const { getProductConfig, testEndpoint } = require('../controllers/productController');
const { handleMulterUpload }             = require('../controllers/uploadController');
const { getHealth }                      = require('../controllers/healthController');
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
  handler(req, res) {
    res.status(429).json({
      error:      'Too many requests',
      message:    'Please wait before making more requests',
      retryAfter: '1 minute',
    });
  },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: uploadLimitMax,
  standardHeaders: true,
  legacyHeaders:   false,
  handler(req, res) {
    res.status(429).json({
      error:   'Too many uploads',
      message: `Maximum ${uploadLimitMax} uploads per 15 minutes per IP address exceeded.`,
    });
  },
});

router.get('/health', getHealth);
router.get('/test',   agentKeyMiddleware, testEndpoint);

router.get('/',           apiKeyMiddleware, productLookupLimiter, getProductConfig);
router.post('/upload',    apiKeyMiddleware, uploadLimiter,        handleMulterUpload);

module.exports = router;
