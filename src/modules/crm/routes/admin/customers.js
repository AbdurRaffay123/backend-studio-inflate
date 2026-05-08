'use strict';

const { Router }      = require('express');
const { param, body } = require('express-validator');
const controller      = require('../../controllers/adminCustomerController');
const jwtAuth         = require('../../middleware/jwtAuth');
const validate        = require('../../middleware/validate');

const router = Router();
router.use(jwtAuth);

router.get('/', controller.list);

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
    body('note').optional().isString().trim().isLength({ min: 1 }),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString().trim(),
  ],
  validate,
  controller.update
);

module.exports = router;
