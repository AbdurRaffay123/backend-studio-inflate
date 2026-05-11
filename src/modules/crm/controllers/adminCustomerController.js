'use strict';

const { Types }       = require('mongoose');
const Customer        = require('../models/Customer');
const Consultation    = require('../models/Consultation');
const customerService = require('../services/customerService');
const { parsePagination, buildResponse } = require('../utils/paginate');
const { buildCsv, toIso } = require('../utils/csvExport');

const isMongoId = (id) => Types.ObjectId.isValid(id) && String(new Types.ObjectId(id)) === id;
const parseDate = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildCustomerListFilter = (req) => {
  const filter = {};
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { firstName: re },
      { lastName: re },
      { email: re },
      { phone: re },
      { shopifyCustomerId: re },
      { tags: re },
    ];
  }

  const memberSinceFrom = parseDate(req.query.memberSinceFrom);
  const memberSinceTo = parseDate(req.query.memberSinceTo);
  if (memberSinceFrom || memberSinceTo) {
    filter.memberSince = {};
    if (memberSinceFrom) {
      memberSinceFrom.setHours(0, 0, 0, 0);
      filter.memberSince.$gte = memberSinceFrom;
    }
    if (memberSinceTo) {
      memberSinceTo.setHours(23, 59, 59, 999);
      filter.memberSince.$lte = memberSinceTo;
    }
  }

  return filter;
};

const customerNotesToCell = (notes) => {
  if (!Array.isArray(notes) || !notes.length) return '';
  return notes
    .map((n) => `${toIso(n.addedAt)}|${n.addedBy || ''}|${(n.text || '').replace(/\r?\n/g, ' ')}`)
    .join(' || ');
};

// GET /api/crm/admin/customers
const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = buildCustomerListFilter(req);

    const [data, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Customer.countDocuments(filter),
    ]);

    return res.json(buildResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/customers/export — CSV (opens in Excel)
const exportCsv = async (req, res, next) => {
  try {
    const filter = buildCustomerListFilter(req);
    const docs = await Customer.find(filter).sort({ createdAt: -1 }).limit(50_000).lean();

    const headers = [
      'id',
      'shopifyCustomerId',
      'email',
      'firstName',
      'lastName',
      'phone',
      'profilePictureUrl',
      'acceptsMarketing',
      'memberSince',
      'createdAt',
      'updatedAt',
      'tags',
      'addresses_json',
      'defaultAddress_json',
      'internalNotes',
    ];

    const rows = docs.map((c) => [
      String(c._id),
      c.shopifyCustomerId,
      c.email,
      c.firstName || '',
      c.lastName || '',
      c.phone || '',
      c.profilePictureUrl || '',
      c.acceptsMarketing === true ? 'true' : c.acceptsMarketing === false ? 'false' : '',
      toIso(c.memberSince),
      toIso(c.createdAt),
      toIso(c.updatedAt),
      Array.isArray(c.tags) ? c.tags.join('; ') : '',
      c.addresses && c.addresses.length ? JSON.stringify(c.addresses) : '',
      c.defaultAddress ? JSON.stringify(c.defaultAddress) : '',
      customerNotesToCell(c.notes),
    ]);

    const csv = buildCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customers-export-${stamp}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/customers/:id
// Accepts either a MongoDB ObjectId or a Shopify GID / shopifyCustomerId string.
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = isMongoId(id)
      ? await Customer.findById(id).lean()
      : await Customer.findOne({ shopifyCustomerId: id }).lean();

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

module.exports = { list, getById, update, exportCsv };
