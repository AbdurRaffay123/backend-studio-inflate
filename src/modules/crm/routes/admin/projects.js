'use strict';

const { Router }             = require('express');
const { param, body, query } = require('express-validator');
const controller             = require('../../controllers/adminProjectController');
const jwtAuth                = require('../../middleware/jwtAuth');
const validate               = require('../../middleware/validate');

const { PROJECT_STATUSES } = require('../../models/Project');

const router = Router();
router.use(jwtAuth);

router.get(
  '/',
  [
    query('status').optional().isIn(PROJECT_STATUSES),
    query('shopifyCustomerId').optional().isString(),
    query('assignedArtistId').optional().isMongoId(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  controller.list
);

router.get(
  '/:id',
  [param('id').isMongoId()],
  validate,
  controller.getById
);

router.post(
  '/',
  [
    body('shopifyCustomerId').isString().notEmpty(),
    body('consultationId').optional({ nullable: true }).isMongoId(),
    body('assignedArtistId').optional({ nullable: true }).isMongoId(),
    body('title').optional().isString().trim().isLength({ max: 200 }),
    body('description').optional().isString().trim(),
    body('status').optional().isIn(PROJECT_STATUSES),
    body('eventDate').optional({ nullable: true }).isISO8601(),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('estimatedBudget').optional({ nullable: true }).isNumeric(),
    body('tags').optional().isArray(),
  ],
  validate,
  controller.create
);

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('status').optional().isIn(PROJECT_STATUSES),
    body('note').optional().isString().trim().isLength({ min: 1 }),
    body('assignedArtistId').optional({ nullable: true }).isMongoId(),
    body('title').optional().isString().trim().isLength({ max: 200 }),
    body('description').optional().isString().trim(),
    body('eventDate').optional({ nullable: true }).isISO8601(),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('completedAt').optional({ nullable: true }).isISO8601(),
    body('estimatedBudget').optional({ nullable: true }).isNumeric(),
    body('actualCost').optional({ nullable: true }).isNumeric(),
    body('tags').optional().isArray(),
    body('deliverable').optional().isObject(),
    body('deliverable.title').if(body('deliverable').exists()).isString().notEmpty(),
  ],
  validate,
  controller.update
);

module.exports = router;
