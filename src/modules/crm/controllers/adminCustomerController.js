'use strict';

const Customer        = require('../models/Customer');
const Consultation    = require('../models/Consultation');
const customerService = require('../services/customerService');
const { parsePagination, buildResponse } = require('../utils/paginate');

// GET /api/crm/admin/customers
const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (req.query.q) {
      const re = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ firstName: re }, { lastName: re }, { email: re }, { phone: re }];
    }

    const [data, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    return res.json(buildResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/customers/:id
const getById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Customer not found' });
    }

    const consultations = await Consultation
      .find({ shopifyCustomerId: customer.shopifyCustomerId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ data: { ...customer, consultations } });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/crm/admin/customers/:id
const update = async (req, res, next) => {
  try {
    const { note, tags } = req.body;

    let customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Customer not found' });
    }

    if (note) {
      customer = await customerService.addNote(req.params.id, {
        text:    note,
        addedBy: req.admin.sub,
      });
    }

    if (Array.isArray(tags)) {
      customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { $set: { tags } },
        { new: true }
      );
    }

    return res.json({ data: customer });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, update };
