'use strict';

/**
 * Tiny env helpers shared by all modules.
 */

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

const isTruthy = (raw) => {
  if (raw == null) return false;
  return TRUE_VALUES.has(String(raw).trim().toLowerCase());
};

/**
 * Read a feature flag, defaulting to true unless explicitly disabled.
 * Use ENABLE_X=false to disable a module without touching code.
 */
const isModuleEnabled = (key, defaultValue = true) => {
  const raw = process.env[key];
  if (raw == null || raw === '') return defaultValue;
  return isTruthy(raw);
};

module.exports = { isTruthy, isModuleEnabled };
