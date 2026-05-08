'use strict';

/**
 * Integration tests for /api/crm/customers (public, x-api-key auth).
 *
 * Covers:
 *  - POST /api/crm/customers  — upsert with all profile fields incl. addresses,
 *                               defaultAddress, profilePictureUrl (S3), acceptsMarketing
 *  - GET  /api/crm/customers/:shopifyId
 *  - Auth enforcement
 */

const request = require('supertest');

// ── Infrastructure mocks ─────────────────────────────────────────────────────
jest.mock('../../src/shared/config/db', () => ({
  connect:  jest.fn().mockResolvedValue(undefined),
  isReady:  jest.fn().mockReturnValue(true),
}));

jest.mock('../../src/modules/apps/product-options/controllers/healthController', () => ({
  getHealth:                (_req, res) => res.json({ status: 'ok' }),
  getProductOptionsHealth:  () => ({ ok: true }),
}));

// ── Mock customerService ──────────────────────────────────────────────────────
const mockCustomerService = {
  upsertCustomer:         jest.fn(),
  getCustomerByShopifyId: jest.fn(),
  addNote:                jest.fn(),
};
jest.mock('../../src/modules/crm/services/customerService', () => mockCustomerService);

// ── Mock Consultation model (used inside getByShopifyId) ─────────────────────
jest.mock('../../src/modules/crm/models/Consultation', () => ({
  find: jest.fn().mockReturnValue({
    sort:   function() { return this; },
    select: function() { return this; },
    lean:   () => Promise.resolve([]),
  }),
}));

process.env.API_KEY      = 'test-api-key';
process.env.JWT_SECRET   = 'test-secret-32-chars-long-enough!';
process.env.ADMIN_EMAIL  = 'admin@test.com';

const { createApp } = require('../../src/createApp');

const GOOD_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key':    'test-api-key',
};

const GID = 'gid://shopify/Customer/77777';

const STUB_CUSTOMER_DATA = {
  _id:               '6646000000000000000000d1',
  shopifyCustomerId: GID,
  email:             'jane@example.com',
  firstName:         'Jane',
  lastName:          'Doe',
  phone:             '+14155550123',
  profilePictureUrl: 'https://my-bucket.s3.amazonaws.com/avatars/jane.jpg',
  acceptsMarketing:  true,
  addresses:         [{ address1: '123 Main St', city: 'LA', country: 'US' }],
  defaultAddress:    { address1: '123 Main St', city: 'LA', country: 'US' },
  memberSince:       new Date().toISOString(),
};

// The controller calls customer.toObject() so the stub needs the method.
const STUB_CUSTOMER = { ...STUB_CUSTOMER_DATA, toObject: () => STUB_CUSTOMER_DATA };

describe('POST /api/crm/customers', () => {
  let app;

  beforeAll(() => { app = createApp(); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomerService.upsertCustomer.mockResolvedValue(STUB_CUSTOMER);
  });

  // ── Auth ───────────────────────────────────────────────────────────────────
  it('returns 401 when x-api-key is missing', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .send({ shopifyCustomerId: GID, email: 'jane@example.com' });
    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  it('returns 422 when shopifyCustomerId is missing', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ email: 'jane@example.com' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when email is invalid', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('returns 422 for a non-boolean acceptsMarketing', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, email: 'jane@example.com', acceptsMarketing: 'yes' });
    expect(res.status).toBe(422);
  });

  // ── Success (minimal payload) ──────────────────────────────────────────────
  it('returns 200 and customer data for a minimal valid payload', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, email: 'jane@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.shopifyCustomerId).toBe(GID);
  });

  // ── Full profile payload incl. S3 profilePictureUrl ───────────────────────
  it('passes all profile fields (incl. S3 picture URL) to the service', async () => {
    const payload = {
      shopifyCustomerId: GID,
      email:             'jane@example.com',
      firstName:         'Jane',
      lastName:          'Doe',
      phone:             '+14155550123',
      profilePictureUrl: 'https://my-bucket.s3.amazonaws.com/avatars/jane.jpg',
      acceptsMarketing:  true,
      addresses: [{ address1: '123 Main St', city: 'LA', country: 'US' }],
      defaultAddress: { address1: '123 Main St', city: 'LA', country: 'US' },
    };

    await request(app).post('/api/crm/customers').set(GOOD_HEADERS).send(payload);

    expect(mockCustomerService.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        shopifyCustomerId: GID,
        email:             'jane@example.com',
        profilePictureUrl: 'https://my-bucket.s3.amazonaws.com/avatars/jane.jpg',
        acceptsMarketing:  true,
      })
    );
  });

  // ── addresses field is an array ────────────────────────────────────────────
  it('returns 422 when addresses is not an array', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, email: 'jane@example.com', addresses: 'nope' });
    expect(res.status).toBe(422);
  });

  // ── defaultAddress field ───────────────────────────────────────────────────
  it('returns 422 when defaultAddress is not an object', async () => {
    const res = await request(app)
      .post('/api/crm/customers')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, email: 'jane@example.com', defaultAddress: 'string' });
    expect(res.status).toBe(422);
  });
});

// Lazily-required so the mock reference is stable across all describe blocks
const Consultation = require('../../src/modules/crm/models/Consultation');

const resetConsultationMock = () => {
  Consultation.find.mockReturnValue({
    sort:   function() { return this; },
    select: function() { return this; },
    lean:   () => Promise.resolve([]),
  });
};

// ── GET /api/crm/customers/:shopifyId ─────────────────────────────────────────
describe('GET /api/crm/customers/:shopifyId', () => {
  let app;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => {
    jest.clearAllMocks();
    // Restore Consultation.find after clearAllMocks wipes the implementation
    resetConsultationMock();
  });

  it('returns 401 without API key', async () => {
    const res = await request(app).get('/api/crm/customers/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 404 when customer is not found', async () => {
    mockCustomerService.getCustomerByShopifyId.mockResolvedValueOnce(null);
    const unknownGid = encodeURIComponent('gid://shopify/Customer/000');
    const res = await request(app)
      .get(`/api/crm/customers/${unknownGid}`)
      .set(GOOD_HEADERS);
    expect(res.status).toBe(404);
  });

  it('returns the customer document', async () => {
    mockCustomerService.getCustomerByShopifyId.mockResolvedValueOnce(STUB_CUSTOMER);
    const encoded = encodeURIComponent(GID);
    const res = await request(app)
      .get(`/api/crm/customers/${encoded}`)
      .set(GOOD_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('jane@example.com');
    expect(res.body.data.profilePictureUrl).toBe(
      'https://my-bucket.s3.amazonaws.com/avatars/jane.jpg'
    );
  });
});
