'use strict';

const request = require('supertest');
const bcrypt  = require('bcryptjs');

jest.mock('../../src/shared/config/db', () => ({
  connect: jest.fn().mockResolvedValue(undefined),
  isReady: jest.fn().mockReturnValue(true),
}));

jest.mock('../../src/modules/apps/product-options/controllers/healthController', () => ({
  getHealth: (req, res) => res.json({ status: 'ok' }),
  getProductOptionsHealth: () => ({ ok: true }),
}));

const { createApp } = require('../../src/createApp');

describe('POST /api/crm/admin/auth/login', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET           = 'test-secret-32-chars-long-enough!';
    process.env.JWT_EXPIRES_IN       = '1h';
    process.env.ADMIN_EMAIL          = 'admin@test.com';
    process.env.ADMIN_PASSWORD_HASH  = await bcrypt.hash('correct-password', 10);
    app = createApp();
  });

  it('returns 422 for missing fields', async () => {
    const res = await request(app).post('/api/crm/admin/auth/login').send({});
    expect(res.status).toBe(422);
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/crm/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns a JWT for correct credentials', async () => {
    const res = await request(app)
      .post('/api/crm/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('token');
  });

  it('returns 401 for wrong email', async () => {
    const res = await request(app)
      .post('/api/crm/admin/auth/login')
      .send({ email: 'other@test.com', password: 'correct-password' });
    expect(res.status).toBe(401);
  });
});
