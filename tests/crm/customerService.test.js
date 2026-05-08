'use strict';

/**
 * Unit tests for upsertCustomer's E11000 (duplicate key) race fallback.
 *
 * Mongoose Customer model is mocked so we can simulate:
 *   - happy path: findOneAndUpdate resolves with a doc
 *   - race path : first findOneAndUpdate throws { code: 11000 }, second
 *                 (the fallback plain update) returns the existing doc
 *   - hard-race : both findOneAndUpdate calls miss; findOne saves us
 *   - unrelated error: anything other than 11000 propagates
 */

const mockFindOneAndUpdate = jest.fn();
const mockFindOne          = jest.fn();

jest.mock('../../src/modules/crm/models/Customer', () => ({
  findOneAndUpdate: (...args) => mockFindOneAndUpdate(...args),
  findOne:          (...args) => mockFindOne(...args),
}));

const { upsertCustomer } = require('../../src/modules/crm/services/customerService');

const baseInput = {
  shopifyCustomerId: 'gid://shopify/Customer/123',
  email:             'race@test.com',
  firstName:         'Race',
  lastName:          'Test',
};

describe('upsertCustomer', () => {
  beforeEach(() => {
    mockFindOneAndUpdate.mockReset();
    mockFindOne.mockReset();
  });

  it('returns the upserted document on the happy path', async () => {
    const expected = { _id: 'a', ...baseInput };
    mockFindOneAndUpdate.mockResolvedValueOnce(expected);

    const result = await upsertCustomer(baseInput);

    expect(result).toBe(expected);
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('falls back to a plain update when E11000 fires (concurrent insert race)', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const recovered = { _id: 'a', ...baseInput };

    mockFindOneAndUpdate
      .mockRejectedValueOnce(dupErr)       // first call (upsert) loses the race
      .mockResolvedValueOnce(recovered);   // second call (plain update) wins

    const result = await upsertCustomer(baseInput);

    expect(result).toBe(recovered);
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(2);
    // The fallback call must NOT request upsert again — it's a plain update.
    const secondOpts = mockFindOneAndUpdate.mock.calls[1][2];
    expect(secondOpts.upsert).toBeFalsy();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('falls back to findOne() when both upsert and the plain update miss', async () => {
    const dupErr = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    const recovered = { _id: 'a', ...baseInput };

    mockFindOneAndUpdate
      .mockRejectedValueOnce(dupErr)       // upsert race
      .mockResolvedValueOnce(null);        // plain update returns null
    mockFindOne.mockResolvedValueOnce(recovered);

    const result = await upsertCustomer(baseInput);

    expect(result).toBe(recovered);
    expect(mockFindOne).toHaveBeenCalledWith({ shopifyCustomerId: baseInput.shopifyCustomerId });
  });

  it('propagates non-11000 errors unchanged', async () => {
    const otherErr = Object.assign(new Error('validation failed'), { code: 121 });
    mockFindOneAndUpdate.mockRejectedValueOnce(otherErr);

    await expect(upsertCustomer(baseInput)).rejects.toBe(otherErr);
    expect(mockFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockFindOne).not.toHaveBeenCalled();
  });
});
