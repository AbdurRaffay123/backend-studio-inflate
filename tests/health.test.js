'use strict';

const request = require('supertest');

// Avoid touching MongoDB during tests — pretend the connection is ready.
jest.mock('../src/shared/config/db', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  isReady: jest.fn().mockReturnValue(true),
}));

// product-options module also reports readiness based on cached configs;
// stub it to avoid network polling in tests.
jest.mock('../src/modules/apps/product-options/controllers/healthController', () => ({
  getHealth: (req, res) => res.json({ status: 'ok', stub: true }),
  getProductOptionsHealth: () => ({ ok: true, configsLoaded: 1, lastFetched: '2026-01-01T00:00:00Z' }),
}));

const { createApp } = require('../src/createApp');

describe('GET /health (aggregate)', () => {
  let app;
  beforeAll(() => {
    process.env.JWT_SECRET             = 'test-secret';
    process.env.ENABLE_CRM             = 'true';
    process.env.ENABLE_APPS_PRODUCT_OPTIONS = 'true';
    app = createApp();
  });

  it('reports both modules healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.modules.crm).toBeDefined();
    expect(res.body.modules['apps.product-options']).toBeDefined();
  });
});
