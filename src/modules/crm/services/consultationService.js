'use strict';

const Consultation = require('../models/Consultation');

const createConsultation = async (data) => {
  return Consultation.create(data);
};

const getConsultationById = async (id) => {
  return Consultation.findById(id);
};

const updateStatus = async (id, status) => {
  return Consultation.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true, runValidators: true }
  );
};

const listConsultations = async (filter, { skip, limit }) => {
  const [data, total] = await Promise.all([
    Consultation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Consultation.countDocuments(filter),
  ]);
  return { data, total };
};

const addInternalNote = async (id, note) => {
  return Consultation.findByIdAndUpdate(
    id,
    { $push: { internalNotes: { text: note.text, addedBy: note.addedBy, addedAt: new Date() } } },
    { new: true }
  );
};

const updateConsultation = async (id, updates) => {
  return Consultation.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );
};

module.exports = {
  createConsultation,
  getConsultationById,
  updateStatus,
  listConsultations,
  addInternalNote,
  updateConsultation,
};
