'use strict';

const Project = require('../models/Project');

const createProject = async (data) => {
  return Project.create(data);
};

const getProjectById = async (id) => {
  return Project.findById(id).lean();
};

const listProjects = async (filter, { skip, limit }) => {
  const [data, total] = await Promise.all([
    Project.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Project.countDocuments(filter),
  ]);
  return { data, total };
};

const updateProject = async (id, updates) => {
  return Project.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true, runValidators: true }
  );
};

const addInternalNote = async (id, note) => {
  return Project.findByIdAndUpdate(
    id,
    { $push: { internalNotes: { text: note.text, addedBy: note.addedBy, addedAt: new Date() } } },
    { new: true }
  );
};

const addDeliverable = async (id, deliverable) => {
  return Project.findByIdAndUpdate(
    id,
    { $push: { deliverables: deliverable } },
    { new: true }
  );
};

module.exports = {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  addInternalNote,
  addDeliverable,
};
