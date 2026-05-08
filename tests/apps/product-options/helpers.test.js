'use strict';

const { parseTags } = require('../../../src/modules/apps/product-options/utils/helpers');

describe('parseTags', () => {
  it('returns [] for empty / null', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags('')).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
  });

  it('passes arrays through unchanged', () => {
    expect(parseTags(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('parses JSON-stringified arrays', () => {
    expect(parseTags('["sale","new"]')).toEqual(['sale', 'new']);
  });

  it('splits comma-separated strings and trims whitespace', () => {
    expect(parseTags('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('drops empty entries', () => {
    expect(parseTags(',,a,, ,b,')).toEqual(['a', 'b']);
  });
});
