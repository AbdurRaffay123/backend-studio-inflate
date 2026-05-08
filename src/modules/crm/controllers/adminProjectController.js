'use strict';

const projectService = require('../services/projectService');
const { parsePagination, buildResponse } = require('../utils/paginate');

// GET /api/crm/admin/projects
const list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.shopifyCustomerId) filter.shopifyCustomerId = req.query.shopifyCustomerId;
    if (req.query.assignedArtistId) filter.assignedArtistId = req.query.assignedArtistId;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    const { data, total } = await projectService.listProjects(filter, { skip, limit });
    return res.json(buildResponse(data, total, page, limit));
  } catch (err) {
    next(err);
  }
};

// GET /api/crm/admin/projects/:id
const getById = async (req, res, next) => {
  try {
    const project = await projectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Project not found' });
    }
    return res.json({ data: project });
  } catch (err) {
    next(err);
  }
};

// POST /api/crm/admin/projects
const create = async (req, res, next) => {
  try {
    const {
      shopifyCustomerId,
      consultationId,
      assignedArtistId,
      title,
      description,
      status,
      eventDate,
      dueDate,
      estimatedBudget,
      tags,
    } = req.body;

    const project = await projectService.createProject({
      shopifyCustomerId,
      consultationId:   consultationId || null,
      assignedArtistId: assignedArtistId || null,
      title:            title           || '',
      description:      description     || '',
      status:           status          || 'pending',
      eventDate:        eventDate        ? new Date(eventDate) : null,
      dueDate:          dueDate          ? new Date(dueDate)   : null,
      estimatedBudget:  estimatedBudget || null,
      tags:             Array.isArray(tags) ? tags : [],
    });

    return res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/crm/admin/projects/:id
const update = async (req, res, next) => {
  try {
    let project = await projectService.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ statusCode: 404, error: 'NotFound', message: 'Project not found' });
    }

    const {
      status,
      note,
      assignedArtistId,
      title,
      description,
      eventDate,
      dueDate,
      completedAt,
      estimatedBudget,
      actualCost,
      tags,
      deliverable,
    } = req.body;

    const fieldUpdates = {};
    if (status)           fieldUpdates.status           = status;
    if (assignedArtistId) fieldUpdates.assignedArtistId = assignedArtistId;
    if (title !== undefined)       fieldUpdates.title       = title;
    if (description !== undefined) fieldUpdates.description = description;
    if (eventDate)         fieldUpdates.eventDate        = new Date(eventDate);
    if (dueDate)           fieldUpdates.dueDate          = new Date(dueDate);
    if (completedAt)       fieldUpdates.completedAt      = new Date(completedAt);
    if (estimatedBudget !== undefined) fieldUpdates.estimatedBudget = estimatedBudget;
    if (actualCost !== undefined)      fieldUpdates.actualCost      = actualCost;
    if (Array.isArray(tags))           fieldUpdates.tags            = tags;

    if (Object.keys(fieldUpdates).length) {
      project = await projectService.updateProject(req.params.id, fieldUpdates);
    }

    if (note) {
      project = await projectService.addInternalNote(req.params.id, {
        text:    note,
        addedBy: req.admin.sub,
      });
    }

    if (deliverable && deliverable.title) {
      project = await projectService.addDeliverable(req.params.id, deliverable);
    }

    return res.json({ data: project });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getById, create, update };
