'use strict';

const { validationResult } = require('express-validator');

/**
 * Express-validator result handler. Returns a standardized 422 with the
 * first error per field so clients can display useful error messages.
 */
const validate = (req, res, next) => {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(422).json({
      statusCode: 422,
      error:      'ValidationError',
      message:    'Request validation failed',
      details:    result.array({ onlyFirstError: true }),
    });
  }

  next();
};

module.exports = validate;
