'use strict';

const { Router }      = require('express');
const { body, param } = require('express-validator');
const controller      = require('../../controllers/customerController');
const validate        = require('../../middleware/validate');

const router = Router();

router.post(
  '/',
  [
    body('shopifyCustomerId').notEmpty().withMessage('shopifyCustomerId is required'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('profilePictureUrl').optional().isString().trim(),
    body('acceptsMarketing').optional().isBoolean(),
    body('addresses').optional().isArray(),
    body('defaultAddress').optional().isObject(),
  ],
  validate,
  controller.upsert
);

router.get(
  '/:shopifyId',
  [param('shopifyId').notEmpty().withMessage('shopifyId is required')],
  validate,
  controller.getByShopifyId
);

module.exports = router;
