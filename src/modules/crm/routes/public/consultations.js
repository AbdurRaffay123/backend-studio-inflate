'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');
const controller      = require('../../controllers/consultationController');
const validate        = require('../../middleware/validate');

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'cancelled'];
const TYPES    = ['phone', 'virtual', 'in_person'];

const router = Router();

router.post(
  '/',
  [
    body('shopifyCustomerId').notEmpty().withMessage('shopifyCustomerId is required'),
    body('type').isIn(TYPES).withMessage(`type must be one of: ${TYPES.join(', ')}`),
    body('email').optional().isEmail().normalizeEmail(),
    body('duration').optional().isIn([15, 30, 60]),
    body('price').optional().isIn([25, 50, 100]),
    body('scheduledDate').optional().isISO8601(),
    body('intake').optional().isObject(),
  ],
  validate,
  controller.create
);

router.get(
  '/:id',
  [param('id').isMongoId().withMessage('id must be a valid MongoDB ObjectId')],
  validate,
  controller.getById
);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn(STATUSES).withMessage(`status must be one of: ${STATUSES.join(', ')}`),
  ],
  validate,
  controller.updateStatus
);

module.exports = router;
