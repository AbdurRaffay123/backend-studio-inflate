'use strict';

/**
 * CRM module router.
 *
 * Mounted at `/api/crm` by the root createApp.
 *
 * Public (mobile app, x-api-key auth):
 *   /api/crm/consultations
 *   /api/crm/customers
 *
 * Admin (JWT auth, used by the admin SPA at /admin):
 *   /api/crm/admin/auth/login
 *   /api/crm/admin/dashboard
 *   /api/crm/admin/consultations
 *   /api/crm/admin/customers
 */

const { Router } = require('express');
const rateLimit  = require('express-rate-limit');

const apiKey = require('../middleware/apiKey');

const publicConsultations = require('./public/consultations');
const publicCustomers     = require('./public/customers');
const adminAuth           = require('./admin/auth');
const adminDashboard      = require('./admin/dashboard');
const adminConsultations  = require('./admin/consultations');
const adminCustomers      = require('./admin/customers');

const router = Router();

// ── Rate limiters ────────────────────────────────────────────────────────────
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { statusCode: 429, error: 'TooManyRequests', message: 'Rate limit exceeded.' },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      300,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { statusCode: 429, error: 'TooManyRequests', message: 'Rate limit exceeded.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { statusCode: 429, error: 'TooManyRequests', message: 'Too many login attempts. Try again later.' },
});

// ── Public API (apiKey + rate limit) ─────────────────────────────────────────
router.use('/consultations', publicLimiter, apiKey, publicConsultations);
router.use('/customers',     publicLimiter, apiKey, publicCustomers);

// ── Admin API ────────────────────────────────────────────────────────────────
router.use('/admin/auth',          loginLimiter, adminAuth);
router.use('/admin/dashboard',     adminLimiter, adminDashboard);
router.use('/admin/consultations', adminLimiter, adminConsultations);
router.use('/admin/customers',     adminLimiter, adminCustomers);

module.exports = router;
