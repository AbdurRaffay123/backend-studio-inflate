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

const mockConsultationFind = jest.fn();
jest.mock('../../src/modules/crm/models/Consultation', () => ({
  find: (...args) => mockConsultationFind(...args),
}));

const { createApp } = require('../../src/createApp');

describe('GET /api/crm/admin/consultations/export', () => {
  let app;
  let token;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!';
    app = createApp();
    token = jwt.sign({ sub: 'admin@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsultationFind.mockReturnValue({
      sort() {
        return this;
      },
      limit() {
        return this;
      },
      lean: () =>
        Promise.resolve([
          {
            _id:               '507f1f77bcf86cd799439011',
            createdAt:         new Date('2026-05-01T12:00:00.000Z'),
            updatedAt:         new Date('2026-05-02T12:00:00.000Z'),
            shopifyCustomerId: 'gid://shopify/Customer/1',
            shopifyOrderId:    null,
            shopifyOrderName:  null,
            fullName:          'Jane Doe',
            email:             'jane@example.com',
            phone:             '+1',
            status:            'new',
            type:              'phone',
            scheduledDate:     new Date('2026-06-01T00:00:00.000Z'),
            scheduledTime:     '10:00',
            duration:          30,
            price:             50,
            intake:            { eventType: 'Wedding' },
            internalNotes:     [],
          },
        ]),
    });
  });

  it('returns CSV for Excel', async () => {
    const res = await request(app)
      .get('/api/crm/admin/consultations/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="consultations-export-/);
    expect(res.text).toContain('shopifyCustomerId');
    expect(res.text).toContain('gid://shopify/Customer/1');
  });
});
