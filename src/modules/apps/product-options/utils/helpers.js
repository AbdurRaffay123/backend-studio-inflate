'use strict';

/**
 * Safely parse Shopify product tags from any of the formats the storefront
 * may send: array, JSON-stringified array, or comma-separated string.
 */
function parseTags(tags) {
  if (!tags) return [];

  if (Array.isArray(tags)) return tags;

  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — fall through to CSV parsing
    }

    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return [];
}

module.exports = { parseTags };
