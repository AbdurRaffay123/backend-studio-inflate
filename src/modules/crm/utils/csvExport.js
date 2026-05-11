'use strict';

/**
 * RFC 4180-ish CSV helpers. UTF-8 BOM prefix helps Excel open UTF-8 correctly.
 */

const csvCell = (value) => {
  if (value == null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const csvRow = (cells) => cells.map(csvCell).join(',');

const toIso = (d) => (d ? new Date(d).toISOString() : '');

const buildCsv = (headerRow, dataRows) => `\uFEFF${[csvRow(headerRow), ...dataRows.map(csvRow)].join('\r\n')}\r\n`;

module.exports = { csvCell, csvRow, toIso, buildCsv };
