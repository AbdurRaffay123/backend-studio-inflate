'use strict';

const consultationService = require('../services/consultationService');
const customerService     = require('../services/customerService');

// POST /api/crm/consultations
const create = async (req, res, next) => {
  try {
    const consultation = await consultationService.createConsultation(req.body);

    // Opportunistically keep the CRM customer record in sync without blocking the response
    if (req.body.shopifyCustomerId) {
      customerService.upsertCustomer({
        shopifyCustomerId: req.body.shopifyCustomerId,
        email:     req.body.email,
        firstName: req.body.firstName,
        lastName:  req.body.lastName,
        phone:     req.body.phone,
      }).catch(() => {});
    }

    return res.status(201).json({ data: consultation });
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/consultations/:id
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

// PATCH /api/crm/consultations/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const updated = await consultationService.updateStatus(req.params.id, req.body.status);
    if (!updated) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Consultation not found' });
    }
    return res.json({ data: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { create, getById, updateStatus };
