'use strict';

const { parseTags }                     = require('../utils/helpers');
const { logToFile, getLogFilePath }     = require('../../../../shared/utils/fileLogger');
const { getProductConfiguration, checkConditionsWithLogging } = require('../services/productService');
const { getAppData, getConfigListsCache, getLastFetchedAt }   = require('../services/appDataService');

const LOG_REQUESTS = process.env.LOG_REQUESTS === '1' || process.env.LOG_REQUESTS === 'true';

function getProductConfig(req, res) {
  const app_data = getAppData();
  const product  = req.query;
  product.tags = parseTags(product.tags);
  product.id   = product.id ? product.id.match(/\d+/g)?.join('') : undefined;

  const configs = getProductConfiguration(product, app_data);

  if (configs && configs.length > 0) {
    const cleanConfigs = configs.map((config) => {
      const c = { ...config };
      delete c.css;
      delete c.styles;
      delete c.theme;
      delete c.previewConfig;
      return c;
    });

    const listsCache = getConfigListsCache();
    const allLists = {};
    for (const config of cleanConfigs) {
      const key = config.uuid ?? config.id ?? config.name;
      if (key && listsCache.has(key)) {
        Object.assign(allLists, listsCache.get(key));
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Found ${cleanConfigs.length} matching config(s)`);
    }

    const responsePayload = { configs: cleanConfigs, lists: allLists };
    res.set('Cache-Control', 'public, max-age=10');

    if (LOG_REQUESTS) {
      logToFile('\n--- /api/apps/product-options Response Payload ---');
      logToFile(JSON.stringify({
        configs:   cleanConfigs.map((c) => ({ id: c.id, uuid: c.uuid, targetMode: c.targetMode })),
        listsKeys: Object.keys(allLists),
      }, null, 2));
    }

    return res.send(responsePayload);
  }

  const responsePayload = { configs: [], lists: {} };
  res.set('Cache-Control', 'public, max-age=10');

  if (LOG_REQUESTS) {
    logToFile('\n--- /api/apps/product-options Response Payload (empty) ---');
    logToFile(JSON.stringify(responsePayload, null, 2));
  }

  res.send(responsePayload);
}

function testEndpoint(req, res) {
  const app_data    = getAppData();
  const logFilePath = getLogFilePath();

  logToFile('\n========== TEST ENDPOINT CALLED ==========');
  logToFile('Raw query params: ' + JSON.stringify(req.query, null, 2));

  const product = { ...req.query };

  logToFile('\n--- Original Product Data ---');
  logToFile(JSON.stringify(product, null, 2));

  product.tags = parseTags(product.tags);
  const originalId = product.id;
  product.id = product.id ? product.id.match(/\d+/g)?.join('') : undefined;

  logToFile('\n--- Processed Product Data ---');
  logToFile('Original ID: ' + originalId);
  logToFile('Processed ID: ' + product.id);
  logToFile('Tags (array): ' + JSON.stringify(product.tags));
  logToFile('Full processed product: ' + JSON.stringify(product, null, 2));

  if (!app_data || !app_data.configs) {
    logToFile('\n--- ERROR: app_data not loaded yet ---');
    return res.status(503).json({
      error:   'App data not loaded yet. Please wait a moment and try again.',
      product: product,
    });
  }

  logToFile('\n--- Available Configs ---');
  logToFile(`Total configs: ${app_data.configs.length}`);

  const matchedConfigs = [];
  for (let i = 0; i < app_data.configs.length; i++) {
    const config = app_data.configs[i];
    logToFile(`\n--- Checking Config ${i + 1} ---`);
    logToFile(`Config ID: ${config.uuid || 'no id'}`);
    logToFile(`Config targetMode: ${config.targetMode} (0=single product, 1=multiple products)`);

    if (config.targetMode == 0) {
      logToFile(`Single product mode - checking config.product.id: "${config.product?.id}"`);
      logToFile(`Against product.id: "${product.id}"`);

      const configId = config.product?.id ? String(config.product.id) : '';
      const queryId  = product.id ? String(product.id) : '';
      const idMatch  = configId === queryId;
      logToFile(`ID match: ${idMatch} (comparison: "${configId}" == "${queryId}")`);

      if (idMatch) {
        logToFile(`✓ CONFIG ${i + 1} MATCHES (single product mode)`);
        matchedConfigs.push(config);
      } else {
        logToFile(`✗ Config ${i + 1} does not match (IDs don't match)`);
      }
    } else {
      logToFile('Multiple products mode - checking conditions');
      logToFile(`Condition mode: ${config.conditionMode} (1=any, 0=all)`);
      logToFile(`Number of conditions: ${config.conditions?.length || 0}`);

      if (!config.conditions || config.conditions.length === 0) {
        logToFile(`✗ Config ${i + 1} does not match (no conditions)`);
        continue;
      }

      const conditionsResult = checkConditionsWithLogging(config.conditions, product, config.conditionMode, i + 1);

      if (conditionsResult) {
        logToFile(`✓ CONFIG ${i + 1} MATCHES (conditions satisfied)`);
        matchedConfigs.push(config);
      } else {
        logToFile(`✗ Config ${i + 1} does not match (conditions not satisfied)`);
      }
    }
  }

  logToFile('\n--- Matching Result ---');
  if (matchedConfigs.length > 0) {
    logToFile(`✓ Found ${matchedConfigs.length} matching config(s)`);
    matchedConfigs.forEach((config, index) => {
      logToFile(`  Config ${index + 1}: ID=${config.id || 'no id'}, targetMode=${config.targetMode}`);
    });
  } else {
    logToFile('✗ No matching config found');
  }

  logToFile('\n--- Response Being Sent ---');
  logToFile(`Response contains ${matchedConfigs.length} matching config(s) (out of ${app_data.configs.length} total)`);
  logToFile('Total lists available: ' + Object.keys(app_data.lists || {}).length);

  const lists = app_data.lists || {};
  const sampleConfigIds = app_data.configs
    .slice(0, 5)
    .map((c) => c.uuid ?? c.id)
    .filter((id) => id !== undefined && id !== null);

  const responsePayload = {
    test: true,
    logFile: logFilePath,
    message: `Detailed logs written to: ${logFilePath}`,
    receivedProduct: req.query,
    processedProduct: product,
    matchedConfigs: matchedConfigs.map((config) => ({
      id:         config.id,
      uuid:       config.uuid,
      targetMode: config.targetMode,
      hasLists:   !!config.lists,
      listsCount: config.lists?.length || 0,
    })),
    matchedConfigsCount: matchedConfigs.length,
    totalConfigs: app_data.configs.length,
    responseContains: {
      allConfigs:           false,
      allLists:             false,
      matchedConfigsCount:  matchedConfigs.length,
      listsKeys:            Object.keys(lists),
    },
    configsLoaded: app_data.configs.length,
    listsLoaded:   Object.keys(lists).length,
    lastFetched:   getLastFetchedAt(),
    sampleConfigIds,
  };

  const env = (process.env.NODE_ENV || '').trim();
  if (env !== 'development' && env !== 'test') {
    responsePayload.warning =
      'This endpoint is intended for development use only. Do not expose in production.';
  }

  logToFile('\n--- /test Response Payload ---');
  logToFile(JSON.stringify({
    matchedConfigs:    matchedConfigs.map((c) => ({ id: c.id, uuid: c.uuid, targetMode: c.targetMode })),
    receivedProduct:   req.query,
    processedProduct:  product,
  }, null, 2));

  res.json(responsePayload);
}

module.exports = { getProductConfig, testEndpoint };
