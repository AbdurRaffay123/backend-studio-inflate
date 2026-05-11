'use strict';

const consultationService = require('../services/consultationService');
const { parsePagination, buildResponse } = require('../utils/paginate');
const { buildCsv, toIso } = require('../utils/csvExport');

const buildConsultationListFilter = (req) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.shopifyCustomerId) filter.shopifyCustomerId = req.query.shopifyCustomerId;
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }
  return filter;
};

const internalNotesToCell = (notes) => {
  if (!Array.isArray(notes) || !notes.length) return '';
  return notes
    .map((n) => `${toIso(n.addedAt)}|${n.addedBy || ''}|${(n.text || '').replace(/\r?\n/g, ' ')}`)
    .join(' || ');
};

// GET /api/crm/admin/consultations
const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = buildConsultationListFilter(req);

    const { data, total } = await consultationService.listConsultations(filter, { skip, limit });
    return res.json(buildResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/consultations/export — CSV (opens in Excel)
const exportCsv = async (req, res, next) => {
  try {
    const filter = buildConsultationListFilter(req);
    const docs = await consultationService.findConsultationsForExport(filter);

    const headers = [
      'id',
      'createdAt',
      'updatedAt',
      'shopifyCustomerId',
      'shopifyOrderId',
      'shopifyOrderName',
      'fullName',
      'email',
      'phone',
      'status',
      'type',
      'scheduledDate',
      'scheduledTime',
      'duration',
      'price',
      'intake_eventType',
      'intake_eventDate',
      'intake_eventTime',
      'intake_endDate',
      'intake_endTime',
      'intake_venueName',
      'intake_venueType',
      'intake_venueAddress',
      'intake_setupLocation',
      'intake_setupDate',
      'intake_setupTime',
      'intake_tearDownDate',
      'intake_tearDownTime',
      'intake_guestCount',
      'intake_services',
      'intake_budgetRange',
      'intake_colorPalette',
      'intake_narrative',
      'intake_additionalNotes',
      'intake_inspirationPics',
      'internalNotes',
    ];

    const rows = docs.map((c) => {
      const i = c.intake || {};
      return [
        String(c._id),
        toIso(c.createdAt),
        toIso(c.updatedAt),
        c.shopifyCustomerId,
        c.shopifyOrderId || '',
        c.shopifyOrderName || '',
        c.fullName || '',
        c.email || '',
        c.phone || '',
        c.status,
        c.type,
        toIso(c.scheduledDate),
        c.scheduledTime || '',
        c.duration ?? '',
        c.price ?? '',
        i.eventType || '',
        toIso(i.eventDate),
        i.eventTime || '',
        toIso(i.endDate),
        i.endTime || '',
        i.venueName || '',
        i.venueType || '',
        i.venueAddress || '',
        i.setupLocation || '',
        toIso(i.setupDate),
        i.setupTime || '',
        toIso(i.tearDownDate),
        i.tearDownTime || '',
        i.guestCount ?? '',
        Array.isArray(i.services) ? i.services.join('; ') : '',
        i.budgetRange || '',
        i.colorPalette || '',
        i.narrative || '',
        i.additionalNotes || '',
        Array.isArray(i.inspirationPics) ? i.inspirationPics.join('; ') : '',
        internalNotesToCell(c.internalNotes),
      ];
    });

    const csv = buildCsv(headers, rows);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="consultations-export-${stamp}.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/consultations/:id
const getById = async (req, res, next) => {
  try {
    const consultation = await consultationService.getConsultationById(req.params.id);
    if (!consultation) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Consultation not found' });
    }
    return res.json({ data: consultation });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/crm/admin/consultations/:id
const update = async (req, res, next) => {
  try {
    const { status, note } = req.body;

    let consultation = await consultationService.getConsultationById(req.params.id);
    if (!consultation) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Consultation not found' });
    }

    if (status) {
      consultation = await consultationService.updateConsultation(req.params.id, { status });
    }

    if (note) {
      consultation = await consultationService.addInternalNote(req.params.id, {
        text:    note,
        addedBy: req.admin.sub,
      });
    }

    return res.json({ data: consultation });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, update, exportCsv };
