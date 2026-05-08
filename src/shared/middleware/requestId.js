'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Adds a stable request id to every request. Honors an inbound
 * x-request-id header so callers can trace requests end-to-end.
 */
const requestId = (req, res, next) => {
  const incoming = String(req.headers['x-request-id'] || req.headers['x-correlation-id'] || '')
    .trim()
    .slice(0, 128);
  req.id = incoming || uuidv4();
  req.requestId = req.id;
  res.setHeader('x-request-id', req.id);
  next();
};

module.exports = requestId;
