'use strict';

/**
 * Integration tests for POST /api/crm/consultations (public, x-api-key auth).
 *
 * Tests the full GID → CRM pipeline:
 *  - shopifyCustomerId (Shopify GID) is required and flows into the DB record
 *  - uploadedImages (S3 links) are mapped to intake.inspirationPics
 *  - both `type` and `consultationType` aliases are accepted
 *  - x-api-key auth is enforced
 *  - validation returns 422 for bad payloads
 *  - GET /:id works
 *  - PATCH /:id/status works
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

// ── Mock services ─────────────────────────────────────────────────────────────
const mockConsultationService = {
  createConsultation: jest.fn(),
  getConsultationById: jest.fn(),
  updateStatus: jest.fn(),
  listConsultations: jest.fn(),
  addInternalNote: jest.fn(),
  updateConsultation: jest.fn(),
};
jest.mock('../../src/modules/crm/services/consultationService', () => mockConsultationService);

const mockCustomerService = {
  upsertCustomer:          jest.fn().mockResolvedValue({}),
  getCustomerByShopifyId:  jest.fn(),
  addNote:                 jest.fn(),
};
jest.mock('../../src/modules/crm/services/customerService', () => mockCustomerService);

process.env.API_KEY      = 'test-api-key';
process.env.JWT_SECRET   = 'test-secret-32-chars-long-enough!';
process.env.ADMIN_EMAIL  = 'admin@test.com';

const { createApp } = require('../../src/createApp');

const GOOD_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key':    'test-api-key',
};

const GID      = 'gid://shopify/Customer/12345';
const STUB_DOC = {
  _id:               '6646000000000000000000c1',
  shopifyCustomerId: GID,
  type:              'phone',
  status:            'new',
  intake: {
    inspirationPics: ['https://s3.amazonaws.com/bucket/img1.jpg'],
    narrative:       'Garden party',
    services:        ['Balloon arch'],
  },
};

describe('POST /api/crm/consultations', () => {
  let app;

  beforeAll(() => { app = createApp(); });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsultationService.createConsultation.mockResolvedValue(STUB_DOC);
  });

  // ── Auth ───────────────────────────────────────────────────────────────────
  it('returns 401 when x-api-key is missing', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .send({ shopifyCustomerId: GID, type: 'phone' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong api key', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set({ ...GOOD_HEADERS, 'x-api-key': 'wrong-key' })
      .send({ shopifyCustomerId: GID, type: 'phone' });
    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────────────
  it('returns 422 when shopifyCustomerId is missing', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ type: 'phone' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when neither type nor consultationType is provided', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID });
    expect(res.status).toBe(422);
  });

  it('returns 422 for an invalid type value', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, type: 'fax' });
    expect(res.status).toBe(422);
  });

  // ── Success — type ─────────────────────────────────────────────────────────
  it('returns 201 and the saved document for a valid request (type field)', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, type: 'phone' });
    expect(res.status).toBe(201);
    expect(res.body.data.shopifyCustomerId).toBe(GID);
  });

  // ── Success — consultationType alias (mobile sends this field) ─────────────
  it('accepts consultationType as alias for type', async () => {
    const res = await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, consultationType: 'virtual' });
    expect(res.status).toBe(201);
  });

  // ── GID flows into DB record ───────────────────────────────────────────────
  it('passes the Shopify GID to consultationService.createConsultation', async () => {
    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, type: 'phone' });

    expect(mockConsultationService.createConsultation).toHaveBeenCalledWith(
      expect.objectContaining({ shopifyCustomerId: GID })
    );
  });

  // ── S3 images flow into intake.inspirationPics ─────────────────────────────
  it('maps uploadedImages (S3 URLs) to intake.inspirationPics', async () => {
    const s3Urls = [
      'https://my-bucket.s3.amazonaws.com/uploads/a.jpg',
      'https://my-bucket.s3.amazonaws.com/uploads/b.jpg',
    ];

    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, type: 'phone', uploadedImages: s3Urls });

    const payload = mockConsultationService.createConsultation.mock.calls[0][0];
    expect(payload.intake.inspirationPics).toEqual(s3Urls);
  });

  // ── Customer is opportunistically synced ──────────────────────────────────
  it('triggers an async customer upsert when a GID is present', async () => {
    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({ shopifyCustomerId: GID, type: 'phone', email: 'jane@test.com' });

    // Give the fire-and-forget a tick to execute
    await new Promise((r) => setTimeout(r, 10));
    expect(mockCustomerService.upsertCustomer).toHaveBeenCalled();
  });

  // ── All three consultation types ───────────────────────────────────────────
  it.each(['phone', 'virtual', 'in_person'])(
    'accepts type = %s',
    async (type) => {
      const res = await request(app)
        .post('/api/crm/consultations')
        .set(GOOD_HEADERS)
        .send({ shopifyCustomerId: GID, type });
      expect(res.status).toBe(201);
    }
  );

  // ── New fields added 2026-05 ──────────────────────────────────────────────

  it('persists the contact snapshot (fullName / email / phone) on the consultation', async () => {
    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({
        shopifyCustomerId: GID,
        type:              'phone',
        fullName:          'Jane Doe',
        email:             'jane@example.com',
        phone:             '+14155550123',
      });

    const payload = mockConsultationService.createConsultation.mock.calls[0][0];
    expect(payload.fullName).toBe('Jane Doe');
    expect(payload.email).toBe('jane@example.com');
    expect(payload.phone).toBe('+14155550123');
  });

  it('forwards venueType, setup and tear-down fields into intake', async () => {
    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({
        shopifyCustomerId: GID,
        type:              'in_person',
        venueType:         'Residential',
        venueAddress:      '742 Evergreen Terrace',
        setupLocation:     'Backyard',
        setupDate:         '2026-08-15T00:00:00.000Z',
        setupTime:         '08:00',
        tearDownDate:      '2026-08-15T23:00:00.000Z',
        tearDownTime:      '23:00',
        endDate:           '2026-08-16T00:00:00.000Z',
        endTime:           '02:00',
      });

    const payload = mockConsultationService.createConsultation.mock.calls[0][0];
    expect(payload.intake.venueType).toBe('Residential');
    expect(payload.intake.venueAddress).toBe('742 Evergreen Terrace');
    expect(payload.intake.setupLocation).toBe('Backyard');
    expect(payload.intake.setupDate).toBeInstanceOf(Date);
    expect(payload.intake.setupTime).toBe('08:00');
    expect(payload.intake.tearDownDate).toBeInstanceOf(Date);
    expect(payload.intake.tearDownTime).toBe('23:00');
    expect(payload.intake.endDate).toBeInstanceOf(Date);
    expect(payload.intake.endTime).toBe('02:00');
  });

  it('persists shopifyOrderName when supplied alongside shopifyOrderId', async () => {
    await request(app)
      .post('/api/crm/consultations')
      .set(GOOD_HEADERS)
      .send({
        shopifyCustomerId: GID,
        type:              'phone',
        shopifyOrderId:    'gid://shopify/Order/9000',
        shopifyOrderName:  '#1042',
      });

    const payload = mockConsultationService.createConsultation.mock.calls[0][0];
    expect(payload.shopifyOrderId).toBe('gid://shopify/Order/9000');
    expect(payload.shopifyOrderName).toBe('#1042');
  });
});

// ── GET /:id ─────────────────────────────────────────────────────────────────
describe('GET /api/crm/consultations/:id', () => {
  let app;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('returns 422 for a non-Mongo id', async () => {
    const res = await request(app)
      .get('/api/crm/consultations/not-an-id')
      .set(GOOD_HEADERS);
    expect(res.status).toBe(422);
  });

  it('returns 404 when consultation does not exist', async () => {
    mockConsultationService.getConsultationById.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/crm/consultations/6646000000000000000000c1')
      .set(GOOD_HEADERS);
    expect(res.status).toBe(404);
  });

  it('returns the consultation document', async () => {
    mockConsultationService.getConsultationById.mockResolvedValueOnce(STUB_DOC);
    const res = await request(app)
      .get('/api/crm/consultations/6646000000000000000000c1')
      .set(GOOD_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body.data.shopifyCustomerId).toBe(GID);
    expect(res.body.data.intake.inspirationPics).toEqual([
      'https://s3.amazonaws.com/bucket/img1.jpg',
    ]);
  });
});

// ── PATCH /:id/status ─────────────────────────────────────────────────────────
describe('PATCH /api/crm/consultations/:id/status', () => {
  let app;

  beforeAll(() => { app = createApp(); });
  beforeEach(() => jest.clearAllMocks());

  it('returns 422 for an invalid status', async () => {
    const res = await request(app)
      .patch('/api/crm/consultations/6646000000000000000000c1/status')
      .set(GOOD_HEADERS)
      .send({ status: 'unknown' });
    expect(res.status).toBe(422);
  });

  it.each(['new', 'contacted', 'booked', 'completed', 'cancelled'])(
    'accepts status = %s',
    async (status) => {
      mockConsultationService.updateStatus.mockResolvedValueOnce({ ...STUB_DOC, status });
      const res = await request(app)
        .patch('/api/crm/consultations/6646000000000000000000c1/status')
        .set(GOOD_HEADERS)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
  );

  it('returns 404 when the consultation does not exist', async () => {
    mockConsultationService.updateStatus.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch('/api/crm/consultations/6646000000000000000000c1/status')
      .set(GOOD_HEADERS)
      .send({ status: 'booked' });
    expect(res.status).toBe(404);
  });
});
