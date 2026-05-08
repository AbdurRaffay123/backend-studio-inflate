'use strict';

/**
 * Unit tests for src/modules/crm/services/projectService.js
 *
 * The Mongoose Project model is mocked so no MongoDB connection is needed.
 * Covers: createProject, getProjectById, listProjects,
 *         updateProject, addInternalNote, addDeliverable.
 */

// ── Mock the Project model ────────────────────────────────────────────────────
const mockCreate          = jest.fn();
const mockFindById        = jest.fn();
const mockFind            = jest.fn();
const mockCountDocuments  = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.mock('../../src/modules/crm/models/Project', () => {
  const mock = {
    create:             (...a) => mockCreate(...a),
    findById:           (...a) => mockFindById(...a),
    find:               (...a) => mockFind(...a),
    countDocuments:     (...a) => mockCountDocuments(...a),
    findByIdAndUpdate:  (...a) => mockFindByIdAndUpdate(...a),
  };
  mock.PROJECT_STATUSES = ['pending', 'in_progress', 'review', 'completed', 'cancelled'];
  return mock;
});

const {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  addInternalNote,
  addDeliverable,
} = require('../../src/modules/crm/services/projectService');

const STUB = {
  _id:               '6646000000000000000000b1',
  shopifyCustomerId: 'gid://shopify/Customer/99',
  title:             'Summer Graduation',
  status:            'pending',
  internalNotes:     [],
  deliverables:      [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createProject ────────────────────────────────────────────────────────────
describe('createProject', () => {
  it('calls Project.create and returns the new document', async () => {
    mockCreate.mockResolvedValueOnce(STUB);
    const result = await createProject({ shopifyCustomerId: STUB.shopifyCustomerId, title: 'Summer Graduation', status: 'pending' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Summer Graduation');
  });

  it('propagates errors from the DB', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Validation failed'));
    await expect(createProject({ title: 'Bad' })).rejects.toThrow('Validation failed');
  });
});

// ─── getProjectById ───────────────────────────────────────────────────────────
describe('getProjectById', () => {
  it('returns the project when found', async () => {
    mockFindById.mockReturnValueOnce({ lean: () => Promise.resolve(STUB) });
    const result = await getProjectById(STUB._id);
    expect(result.title).toBe('Summer Graduation');
  });

  it('returns null when the project does not exist', async () => {
    mockFindById.mockReturnValueOnce({ lean: () => Promise.resolve(null) });
    const result = await getProjectById('nonexistent');
    expect(result).toBeNull();
  });
});

// ─── listProjects ─────────────────────────────────────────────────────────────
describe('listProjects', () => {
  it('returns data and total for the given filter', async () => {
    mockFind.mockReturnValueOnce({
      sort:  () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([STUB]) }) }) }),
    });
    mockCountDocuments.mockResolvedValueOnce(1);

    const { data, total } = await listProjects({ status: 'pending' }, { skip: 0, limit: 20 });
    expect(data).toHaveLength(1);
    expect(total).toBe(1);
  });

  it('passes filter to both find and countDocuments', async () => {
    const filter = { shopifyCustomerId: 'gid://shopify/Customer/55' };
    mockFind.mockReturnValueOnce({
      sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }) }),
    });
    mockCountDocuments.mockResolvedValueOnce(0);

    await listProjects(filter, { skip: 0, limit: 10 });

    expect(mockFind).toHaveBeenCalledWith(filter);
    expect(mockCountDocuments).toHaveBeenCalledWith(filter);
  });
});

// ─── updateProject ────────────────────────────────────────────────────────────
describe('updateProject', () => {
  it('calls findByIdAndUpdate with $set and returns updated doc', async () => {
    const updated = { ...STUB, status: 'in_progress' };
    mockFindByIdAndUpdate.mockResolvedValueOnce(updated);

    const result = await updateProject(STUB._id, { status: 'in_progress' });

    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      STUB._id,
      { $set: { status: 'in_progress' } },
      { new: true, runValidators: true }
    );
    expect(result.status).toBe('in_progress');
  });
});

// ─── addInternalNote ──────────────────────────────────────────────────────────
describe('addInternalNote', () => {
  it('pushes a note with text, addedBy, and addedAt', async () => {
    const withNote = { ...STUB, internalNotes: [{ text: 'Ready to start', addedBy: 'admin' }] };
    mockFindByIdAndUpdate.mockResolvedValueOnce(withNote);

    const result = await addInternalNote(STUB._id, { text: 'Ready to start', addedBy: 'admin' });

    const call = mockFindByIdAndUpdate.mock.calls[0];
    expect(call[1].$push.internalNotes).toMatchObject({ text: 'Ready to start', addedBy: 'admin' });
    expect(call[1].$push.internalNotes.addedAt).toBeInstanceOf(Date);
    expect(result.internalNotes).toHaveLength(1);
  });
});

// ─── addDeliverable ───────────────────────────────────────────────────────────
describe('addDeliverable', () => {
  it('pushes a deliverable and returns the updated project', async () => {
    const deliverable = {
      title:       'Mood board',
      description: 'Initial colour concept',
      fileUrl:     'https://s3.amazonaws.com/bucket/mood-board.pdf',
    };
    const withDeliverable = { ...STUB, deliverables: [deliverable] };
    mockFindByIdAndUpdate.mockResolvedValueOnce(withDeliverable);

    const result = await addDeliverable(STUB._id, deliverable);

    const call = mockFindByIdAndUpdate.mock.calls[0];
    expect(call[1].$push.deliverables).toMatchObject(deliverable);
    expect(result.deliverables).toHaveLength(1);
  });
});
