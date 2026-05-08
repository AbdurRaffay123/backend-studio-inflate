'use strict';

/**
 * Integration tests for /api/crm/admin/projects.
 *
 * Database calls are mocked through projectService so no real MongoDB
 * connection is needed.
 */

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

// ── Mock projectService ────────────────────────────────────────────────────
const mockProjectService = {
  listProjects:      jest.fn(),
  getProjectById:    jest.fn(),
  createProject:     jest.fn(),
  updateProject:     jest.fn(),
  addInternalNote:   jest.fn(),
  addDeliverable:    jest.fn(),
};
jest.mock('../../src/modules/crm/services/projectService', () => mockProjectService);

const { createApp } = require('../../src/createApp');

const STUB_PROJECT = {
  _id: '6646000000000000000000a1',
  shopifyCustomerId: 'gid://shopify/Customer/99',
  title:  'Test Project',
  status: 'pending',
  internalNotes: [],
  deliverables:  [],
};

describe('/api/crm/admin/projects', () => {
  let app;
  let token;

  beforeAll(async () => {
    process.env.JWT_SECRET           = 'test-secret-32-chars-long-enough!';
    process.env.JWT_EXPIRES_IN       = '1h';
    process.env.ADMIN_EMAIL          = 'admin@test.com';
    process.env.ADMIN_PASSWORD_HASH  = await bcrypt.hash('correct-password', 10);
    app = createApp();

    const res = await request(app)
      .post('/api/crm/admin/auth/login')
      .send({ email: 'admin@test.com', password: 'correct-password' });
    token = res.body.data.token;
  });

  beforeEach(() => {
    Object.values(mockProjectService).forEach((fn) => fn.mockReset());
  });

  // ── Auth guard ───────────────────────────────────────────────────────────
  it('GET / returns 401 without token', async () => {
    const res = await request(app).get('/api/crm/admin/projects');
    expect(res.status).toBe(401);
  });

  // ── List ─────────────────────────────────────────────────────────────────
  it('GET / returns paginated project list', async () => {
    mockProjectService.listProjects.mockResolvedValueOnce({ data: [STUB_PROJECT], total: 1 });

    const res = await request(app)
      .get('/api/crm/admin/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('GET / returns 422 for invalid status filter', async () => {
    const res = await request(app)
      .get('/api/crm/admin/projects?status=invalid_status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);
  });

  // ── Get by ID ────────────────────────────────────────────────────────────
  it('GET /:id returns 404 when not found', async () => {
    mockProjectService.getProjectById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('GET /:id returns the project', async () => {
    mockProjectService.getProjectById.mockResolvedValueOnce(STUB_PROJECT);

    const res = await request(app)
      .get('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Test Project');
  });

  // ── Create ───────────────────────────────────────────────────────────────
  it('POST / returns 422 when shopifyCustomerId is missing', async () => {
    const res = await request(app)
      .post('/api/crm/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No customer' });
    expect(res.status).toBe(422);
  });

  it('POST / creates a project', async () => {
    mockProjectService.createProject.mockResolvedValueOnce({ ...STUB_PROJECT, _id: 'new-id' });

    const res = await request(app)
      .post('/api/crm/admin/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ shopifyCustomerId: 'gid://shopify/Customer/99', title: 'Test Project' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Test Project');
  });

  // ── Update ───────────────────────────────────────────────────────────────
  it('PATCH /:id returns 404 when not found', async () => {
    mockProjectService.getProjectById.mockResolvedValueOnce(null);

    const res = await request(app)
      .patch('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(404);
  });

  it('PATCH /:id updates the status', async () => {
    const updated = { ...STUB_PROJECT, status: 'in_progress' };
    mockProjectService.getProjectById.mockResolvedValueOnce(STUB_PROJECT);
    mockProjectService.updateProject.mockResolvedValueOnce(updated);

    const res = await request(app)
      .patch('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
  });

  it('PATCH /:id returns 422 for invalid status', async () => {
    const res = await request(app)
      .patch('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'flying' });
    expect(res.status).toBe(422);
  });

  it('PATCH /:id adds an internal note', async () => {
    const withNote = { ...STUB_PROJECT, internalNotes: [{ text: 'great event', addedBy: 'admin' }] };
    mockProjectService.getProjectById.mockResolvedValueOnce(STUB_PROJECT);
    mockProjectService.addInternalNote.mockResolvedValueOnce(withNote);

    const res = await request(app)
      .patch('/api/crm/admin/projects/6646000000000000000000a1')
      .set('Authorization', `Bearer ${token}`)
      .send({ note: 'great event' });
    expect(res.status).toBe(200);
    expect(res.body.data.internalNotes).toHaveLength(1);
  });
});
