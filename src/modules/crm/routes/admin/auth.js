'use strict';

const { Router } = require('express');
const { body }   = require('express-validator');
const controller = require('../../controllers/adminAuthController');
const validate   = require('../../middleware/validate');

const router = Router();

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.login
);

module.exports = router;
