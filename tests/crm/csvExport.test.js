'use strict';

const { buildCsv, csvCell } = require('../../src/modules/crm/utils/csvExport');

describe('csvExport', () => {
  it('buildCsv prefixes UTF-8 BOM for Excel', () => {
    const out = buildCsv(['a', 'b'], [['1', '2']]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain('a,b');
    expect(out).toContain('1,2');
  });

  it('csvCell quotes fields containing commas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('csvCell escapes embedded double quotes', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
});
