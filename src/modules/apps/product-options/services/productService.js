'use strict';

const { logToFile } = require('../../../../shared/utils/fileLogger');
const { getProductIdIndex } = require('./appDataService');

function checkProductTagsField(condition, product) {
  const productTags = product.tags || [];
  if (condition.tags && Array.isArray(condition.tags)) {
    return condition.tags.some((tag) => productTags.includes(tag));
  }
  return false;
}

function compareString(productValue, conditionValue, operator) {
  switch (operator) {
    case 'equals':       return productValue === conditionValue;
    case 'not_equals':   return productValue !== conditionValue;
    case 'contains':     return productValue.includes(conditionValue);
    case 'not_contains': return !productValue.includes(conditionValue);
    default:             return false;
  }
}

function checkProductTypeField(condition, product) {
  if (!product.type || !condition.value) return false;
  return compareString(product.type.toLowerCase(), condition.value.toLowerCase(), condition.operator);
}

function checkProductVendorField(condition, product) {
  if (!product.vendor || !condition.value) return false;
  return compareString(product.vendor.toLowerCase(), condition.value.toLowerCase(), condition.operator);
}

function checkProductHandleField(condition, product) {
  if (!product.handle || !condition.value) return false;
  return compareString(product.handle.toLowerCase(), condition.value.toLowerCase(), condition.operator);
}

function checkProductTitleField(condition, product) {
  if (!product.title || !condition.value) return false;
  return compareString(product.title.toLowerCase(), condition.value.toLowerCase(), condition.operator);
}

function checkProductField(condition, product) {
  if (!product.id) return false;

  let productId = product.id.toString();
  if (productId.includes('/')) productId = productId.split('/').pop();

  if (condition.products && Array.isArray(condition.products)) {
    return condition.products.some((p) => {
      let condId = p.id ? p.id.toString() : '';
      if (condId.includes('/')) condId = condId.split('/').pop();
      return condId === productId;
    });
  }

  return false;
}

function checkSingleConditionWithLogging(condition, product, conditionIndex) {
  logToFile(`      Condition ${conditionIndex}: ` + JSON.stringify({
    data: condition.data,
    field: condition.field,
    operator: condition.operator,
    value: condition.value,
    hasProducts: !!condition.products,
    hasTags: !!condition.tags,
  }, null, 2));

  if (condition.data !== 'product') {
    logToFile(`      ✗ Condition ${conditionIndex}: data is not 'product', skipping`);
    return false;
  }

  let result = false;
  switch (condition.field) {
    case 'product':
      result = checkProductField(condition, product);
      logToFile(`      Checking product field - result: ${result}`);
      break;
    case 'product_title':
      result = checkProductTitleField(condition, product);
      logToFile(`      Checking product_title: "${product.title || ''}" - result: ${result}`);
      break;
    case 'product_handle':
      result = checkProductHandleField(condition, product);
      logToFile(`      Checking product_handle: "${product.handle || ''}" - result: ${result}`);
      break;
    case 'product_vendor':
      result = checkProductVendorField(condition, product);
      logToFile(`      Checking product_vendor: "${product.vendor || ''}" - result: ${result}`);
      break;
    case 'product_type':
      result = checkProductTypeField(condition, product);
      logToFile(`      Checking product_type: "${product.type || ''}" - result: ${result}`);
      break;
    case 'product_tags':
      result = checkProductTagsField(condition, product);
      logToFile(`      Checking product_tags: [${(product.tags || []).join(', ')}] - result: ${result}`);
      break;
    default:
      logToFile(`      ✗ Condition ${conditionIndex}: unknown field "${condition.field}"`);
      result = false;
  }

  return result;
}

function checkSingleCondition(condition, product) {
  if (condition.data !== 'product') return false;

  switch (condition.field) {
    case 'product':         return checkProductField(condition, product);
    case 'product_title':   return checkProductTitleField(condition, product);
    case 'product_handle':  return checkProductHandleField(condition, product);
    case 'product_vendor':  return checkProductVendorField(condition, product);
    case 'product_type':    return checkProductTypeField(condition, product);
    case 'product_tags':    return checkProductTagsField(condition, product);
    default:                return false;
  }
}

function checkConditionsWithLogging(conditions, product, conditionMode, configIndex) {
  logToFile(`    Checking ${conditions.length} condition(s) with mode ${conditionMode} (1=any, 0=all)`);

  if (conditionMode == 1) {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const result = checkSingleConditionWithLogging(condition, product, i + 1);
      if (result) {
        logToFile(`    ✓ Condition ${i + 1} matched (any mode - returning true)`);
        return true;
      }
    }
    logToFile('    ✗ No conditions matched (any mode - returning false)');
    return false;
  } else {
    for (let i = 0; i < conditions.length; i++) {
      const condition = conditions[i];
      const result = checkSingleConditionWithLogging(condition, product, i + 1);
      if (!result) {
        logToFile(`    ✗ Condition ${i + 1} did not match (all mode - returning false)`);
        return false;
      }
    }
    logToFile('    ✓ All conditions matched (all mode - returning true)');
    return true;
  }
}

function checkConditions(conditions, product, conditionMode) {
  if (conditionMode == 1) {
    return conditions.some((condition) => checkSingleCondition(condition, product));
  }
  return conditions.every((condition) => checkSingleCondition(condition, product));
}

function getProductConfiguration(product, app_data) {
  if (!app_data || !app_data.configs) return [];

  const matchedConfigs = [];
  const queryProductId = product.id ? String(product.id) : '';

  const idIndex = getProductIdIndex();
  if (queryProductId && idIndex.has(queryProductId)) {
    for (const config of idIndex.get(queryProductId)) {
      matchedConfigs.push(config);
    }
  }

  for (const config of app_data.configs) {
    if (config.active === false) continue;
    if (config.targetMode == 0) continue;

    if (config.conditions && config.conditions.length > 0) {
      if (checkConditions(config.conditions, product, config.conditionMode)) {
        matchedConfigs.push(config);
      }
    }
  }

  return [...new Map(matchedConfigs.map((c) => [c.id ?? c.uuid ?? c.name, c])).values()];
}

module.exports = {
  getProductConfiguration,
  checkConditionsWithLogging,
  checkConditions,
  checkSingleCondition,
  checkProductTagsField,
  checkProductTypeField,
  checkProductVendorField,
  checkProductHandleField,
  checkProductTitleField,
  checkProductField,
};
