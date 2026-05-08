'use strict';

const { Router }             = require('express');
const { param, body, query } = require('express-validator');
const controller             = require('../../controllers/adminConsultationController');
const jwtAuth                = require('../../middleware/jwtAuth');
const validate               = require('../../middleware/validate');

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'cancelled'];

const router = Router();
router.use(jwtAuth);

router.get(
  '/',
  [
    query('status').optional().isIn(STATUSES),
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

router.patch(
  '/:id',
  [
    param('id').isMongoId(),
    body('status').optional().isIn(STATUSES),
    body('note').optional().isString().trim().isLength({ min: 1 }),
  ],
  validate,
  controller.update
);

module.exports = router;
