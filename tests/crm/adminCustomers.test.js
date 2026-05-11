'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../src/shared/config/db', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  isReady: jest.fn().mockReturnValue(true),
}));

jest.mock('../../src/modules/apps/product-options/controllers/healthController', () => ({
  getHealth: (_req, res) => res.json({ status: 'ok' }),
  getProductOptionsHealth: () => ({ ok: true }),
}));

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.mock('../../src/modules/crm/models/Customer', () => ({
  find: (...args) => mockFind(...args),
  countDocuments: (...args) => mockCountDocuments(...args),
}));

const { createApp } = require('../../src/createApp');

describe('GET /api/crm/admin/customers', () => {
  let app;
  let token;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!';
    app = createApp();
    token = jwt.sign({ sub: 'admin@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockFind.mockImplementation(() => ({
      sort() { return this; },
      skip() { return this; },
      limit() { return this; },
      lean: () => Promise.resolve([]),
    }));
    mockCountDocuments.mockResolvedValue(0);
  });

  it('searches by Shopify customer id and trims surrounding whitespace', async () => {
    const res = await request(app)
      .get('/api/crm/admin/customers?q=%20%20SEED-003%20%20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const filter = mockFind.mock.calls[0][0];
    expect(Array.isArray(filter.$or)).toBe(true);

    const shopifyMatcher = filter.$or.find((clause) => clause.shopifyCustomerId instanceof RegExp);
    expect(shopifyMatcher).toBeTruthy();
    expect(shopifyMatcher.shopifyCustomerId.test('gid://shopify/Customer/SEED-003')).toBe(true);
  });

  it('includes tags in customer search matching', async () => {
    const res = await request(app)
      .get('/api/crm/admin/customers?q=vip')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const filter = mockFind.mock.calls[0][0];
    const tagsMatcher = filter.$or.find((clause) => clause.tags instanceof RegExp);
    expect(tagsMatcher).toBeTruthy();
    expect(tagsMatcher.tags.test('VIP')).toBe(true);
  });

  it('uses no query filter when q is only whitespace', async () => {
    const res = await request(app)
      .get('/api/crm/admin/customers?q=%20%20%20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({});
    expect(mockCountDocuments).toHaveBeenCalledWith({});
  });
});
