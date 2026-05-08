'use strict';

const { verify } = require('../../../shared/config/jwt');

const jwtAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      statusCode: 401,
      error:      'Unauthorized',
      message:    'Missing or malformed Authorization header',
    });
  }

  const token = authHeader.slice(7);

  try {
    req.admin = verify(token);
    next();
  } catch {
    return res.status(401).json({
      statusCode: 401,
      error:      'Unauthorized',
      message:    'Invalid or expired token',
    });
  }
};

module.exports = jwtAuth;
