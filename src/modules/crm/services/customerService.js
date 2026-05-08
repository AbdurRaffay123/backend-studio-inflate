'use strict';

const Customer = require('../models/Customer');
const logger   = require('../../../shared/utils/logger');

const MONGO_DUPLICATE_KEY = 11000;

/**
 * Create or update a CRM customer record keyed by shopifyCustomerId.
 * Safe to call on every checkout — only updates mutable fields.
 *
 * Concurrency note: two simultaneous requests for the same brand-new
 * shopifyCustomerId can race on the upsert. MongoDB's unique index on
 * shopifyCustomerId guarantees only one INSERT wins; the loser throws
 * E11000. We catch that and re-issue a plain (non-upserting) update so
 * the caller still gets the now-existing document.
 */
const upsertCustomer = async (data) => {
  const {
    shopifyCustomerId,
    email,
    firstName,
    lastName,
    phone,
    profilePictureUrl,
    addresses,
    defaultAddress,
    acceptsMarketing,
  } = data;

  const set = {};
  if (email !== undefined) set.email = email;
  if (firstName !== undefined) set.firstName = firstName;
  if (lastName !== undefined) set.lastName = lastName;
  if (phone !== undefined) set.phone = phone;
  if (profilePictureUrl !== undefined) set.profilePictureUrl = profilePictureUrl;
  if (addresses !== undefined) set.addresses = addresses;
  if (defaultAddress !== undefined) set.defaultAddress = defaultAddress;
  if (acceptsMarketing !== undefined) set.acceptsMarketing = acceptsMarketing;

  const update = {
    $set: set,
    $setOnInsert: {
      shopifyCustomerId,
      memberSince: new Date(),
    },
  };

  const opts = {
    new: true,
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  };

  try {
    return await Customer.findOneAndUpdate({ shopifyCustomerId }, update, opts);
  } catch (err) {
    if (err && err.code === MONGO_DUPLICATE_KEY) {
      logger.warn(
        { shopifyCustomerId },
        'Concurrent upsert race on Customer — retrying as plain update'
      );
      // Document now exists. Drop $setOnInsert (no longer applicable),
      // run a plain findOneAndUpdate, and fall back to findOne() if even
      // that returns null (e.g. the racing write rolled back).
      const existing = await Customer.findOneAndUpdate(
        { shopifyCustomerId },
        { $set: set },
        { new: true, runValidators: true }
      );
      if (existing) return existing;

      const fetched = await Customer.findOne({ shopifyCustomerId });
      if (fetched) return fetched;
    }
    throw err;
  }
};

const getCustomerByShopifyId = async (shopifyCustomerId) => {
  return Customer.findOne({ shopifyCustomerId });
};

const addNote = async (customerId, note) => {
  return Customer.findByIdAndUpdate(
    customerId,
    { $push: { notes: { text: note.text, addedBy: note.addedBy, addedAt: new Date() } } },
    { new: true }
  );
};

module.exports = { upsertCustomer, getCustomerByShopifyId, addNote };
