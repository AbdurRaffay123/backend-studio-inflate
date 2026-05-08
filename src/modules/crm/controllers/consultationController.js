'use strict';

const consultationService = require('../services/consultationService');
const customerService     = require('../services/customerService');
const { mapConsultationPayload, mapCustomerProfile } = require('../utils/payloadMappers');
const logger              = require('../../../shared/utils/logger');

// POST /api/crm/consultations
const create = async (req, res, next) => {
  try {
    const consultationPayload = mapConsultationPayload(req.body);
    const customerProfile = mapCustomerProfile(req.body);
    const consultation = await consultationService.createConsultation(consultationPayload);

    // Opportunistically keep the CRM customer record in sync without blocking the response
    if (customerProfile.shopifyCustomerId) {
      customerService.upsertCustomer(customerProfile).catch((err) => {
        logger.warn('CRM customer upsert failed (non-critical)', {
          shopifyCustomerId: customerProfile.shopifyCustomerId,
          err: err?.message,
        });
      });
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
