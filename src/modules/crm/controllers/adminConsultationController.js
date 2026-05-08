'use strict';

const consultationService = require('../services/consultationService');
const { parsePagination, buildResponse } = require('../utils/paginate');

// GET /api/crm/admin/consultations
const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    const { data, total } = await consultationService.listConsultations(filter, { skip, limit });
    return res.json(buildResponse(data, total, page, limit));
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

module.exports = { list, getById, update };
