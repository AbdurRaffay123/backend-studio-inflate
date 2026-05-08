'use strict';

const customerService = require('../services/customerService');
const Consultation    = require('../models/Consultation');

// POST /api/crm/customers  (upsert)
const upsert = async (req, res, next) => {
  try {
    const customer = await customerService.upsertCustomer(req.body);
    return res.status(200).json({ data: customer });
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/customers/:shopifyId
const getByShopifyId = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerByShopifyId(req.params.shopifyId);
    if (!customer) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Customer not found' });
    }

    const consultations = await Consultation
      .find({ shopifyCustomerId: req.params.shopifyId })
      .sort({ createdAt: -1 })
      .select('type status scheduledDate scheduledTime price intake.eventType createdAt')
      .lean();

    return res.json({ data: { ...customer.toObject(), consultations } });
  } catch (err) {
    next(err);
  }
};

module.exports = { upsert, getByShopifyId };
