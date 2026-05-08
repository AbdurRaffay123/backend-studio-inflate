'use strict';

/**
 * Polls a remote Cloudlift JS asset, parses out `configs` and `lists`,
 * caches them in memory, and exposes O(1) lookup maps for the controller.
 *
 * Behavior preserved verbatim from inflate-studio-product-options.
 */

const { logToFile } = require('../../../../shared/utils/fileLogger');

const appScriptURL =
  process.env.APP_SCRIPT_URL ||
  'https://assets.cloudlift.app/api/assets/options.js?shop=bzehub-jg.myshopify.com';

let app_data = null;
/** @type {Map<string, object[]>} */
let productIdIndex = new Map();
/** @type {Map<string, object>} */
let configListsCache = new Map();
let lastFetchedAt = null;

function getAppData() {
  return app_data;
}

function rebuildProductIdIndex(data) {
  productIdIndex = new Map();
  if (!data || !Array.isArray(data.configs)) return;
  for (const config of data.configs) {
    if (config.active === false) continue;
    if (config.targetMode != 0) continue;
    const id = config.product?.id ? String(config.product.id) : '';
    if (!id) continue;
    if (!productIdIndex.has(id)) productIdIndex.set(id, []);
    productIdIndex.get(id).push(config);
  }
}

function rebuildConfigListsCache(data) {
  configListsCache = new Map();
  if (!data || !Array.isArray(data.configs) || !data.lists) return;
  for (const config of data.configs) {
    if (!config.lists || !Array.isArray(config.lists)) continue;
    const key = config.uuid ?? config.id ?? config.name;
    if (!key) continue;
    const resolved = {};
    for (const listName of config.lists) {
      if (data.lists[listName]) {
        resolved[listName] = data.lists[listName];
      }
    }
    configListsCache.set(key, resolved);
  }
}

function setAppData(data) {
  app_data = data;
  rebuildProductIdIndex(data);
  rebuildConfigListsCache(data);
}

function getProductIdIndex()    { return productIdIndex; }
function getConfigListsCache()  { return configListsCache; }
function getLastFetchedAt()     { return lastFetchedAt; }

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function fetchWithRetries(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (err) {
      lastError = err;
      const msg = `[appDataService] fetch attempt ${attempt}/3 failed: ${err.message}`;
      console.error(msg);
      logToFile(msg);
      if (attempt < 3) await delay(2000 * attempt);
    }
  }
  throw lastError;
}

function validateAppData(result) {
  if (!result || !Array.isArray(result.configs) || result.configs.length === 0) {
    return { ok: false, reason: 'configs must be a non-empty array' };
  }
  for (let i = 0; i < result.configs.length; i++) {
    const c = result.configs[i];
    const hasId   = c != null && c.id   !== undefined && c.id   !== null && c.id   !== '';
    const hasUuid = c != null && c.uuid !== undefined && c.uuid !== null && c.uuid !== '';
    if (!hasId && !hasUuid) {
      return { ok: false, reason: `config at index ${i} missing id or uuid` };
    }
  }
  return { ok: true };
}

function parseEmbeddedAppData(data) {
  const result = {};
  let configsEndIndex = -1;

  const configsMatch = data.match(/"configs"\s*:\s*(\[)/);
  if (configsMatch) {
    const startIndex = configsMatch.index + configsMatch[0].length - 1;
    let bracketCount = 0;
    let endIndex = startIndex;

    for (let i = startIndex; i < data.length; i++) {
      if (data[i] === '[') bracketCount++;
      else if (data[i] === ']') {
        bracketCount--;
        if (bracketCount === 0) { endIndex = i; break; }
      }
    }

    if (bracketCount === 0) {
      const configsArray = JSON.parse(data.substring(startIndex, endIndex + 1));
      configsArray.forEach((config) => {
        delete config.styles;
        delete config.css;
      });
      result.configs = configsArray;
      configsEndIndex = endIndex;
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('configs array not properly closed');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.log('configs array not found');
  }

  const searchStartIndex = configsEndIndex !== -1 ? configsEndIndex + 1 : 0;
  const listsMatch = data.substring(searchStartIndex).match(/"lists"\s*:\s*(\{)/);
  if (listsMatch) {
    const actualListsIndex = searchStartIndex + listsMatch.index;
    const startIndex = actualListsIndex + listsMatch[0].length - 1;
    let bracketCount = 0;
    let endIndex = startIndex;

    for (let i = startIndex; i < data.length; i++) {
      if (data[i] === '{') bracketCount++;
      else if (data[i] === '}') {
        bracketCount--;
        if (bracketCount === 0) { endIndex = i; break; }
      }
    }

    if (bracketCount === 0) {
      result.lists = JSON.parse(data.substring(startIndex, endIndex + 1));
    } else if (process.env.NODE_ENV !== 'production') {
      console.log('lists object not properly closed');
    }
  }

  return result;
}

function parseJsonAppData(text) {
  const result = JSON.parse(text);
  if (result.configs && Array.isArray(result.configs)) {
    result.configs.forEach((config) => {
      delete config.styles;
      delete config.css;
    });
  }
  return result;
}

function parseRemoteAppDataText(text) {
  const fmt = (process.env.APP_DATA_FORMAT || 'auto').trim().toLowerCase();
  if (fmt === 'json')   return parseJsonAppData(text);
  if (fmt === 'script') return parseEmbeddedAppData(text);

  const trimmed = text.trimStart();
  if (trimmed.startsWith('{')) {
    try {
      const candidate = parseJsonAppData(text);
      const validation = validateAppData(candidate);
      if (validation.ok) return candidate;
    } catch { /* fall through */ }
  }
  return parseEmbeddedAppData(text);
}

async function fetchData() {
  let text;
  try {
    text = await fetchWithRetries(appScriptURL);
  } catch (error) {
    const msg = `Error fetching data (all retries failed): ${error.message}`;
    console.error(msg);
    logToFile(msg);
    return;
  }

  let result;
  try {
    result = parseRemoteAppDataText(text);
  } catch (err) {
    const detail = `Parse failed: ${err.message}\n${err.stack || ''}`;
    console.error(detail);
    logToFile(detail);
    return;
  }

  const validation = validateAppData(result);
  if (!validation.ok) {
    const warn = `App data validation failed: ${validation.reason} — keeping previous cache`;
    console.warn(warn);
    logToFile(warn);
    return;
  }

  app_data = result;
  rebuildProductIdIndex(app_data);
  rebuildConfigListsCache(app_data);
  lastFetchedAt = new Date().toISOString();
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[${lastFetchedAt}] Data fetched successfully. Configs: ${app_data.configs.length}, Lists: ${Object.keys(app_data.lists || {}).length}`
    );
  }
}

module.exports = {
  fetchData,
  getAppData,
  setAppData,
  getProductIdIndex,
  getConfigListsCache,
  getLastFetchedAt,
  parseJsonAppData,
  parseRemoteAppDataText,
};
