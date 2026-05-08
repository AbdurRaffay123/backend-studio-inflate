'use strict';

const bcrypt   = require('bcryptjs');
const { sign } = require('../../../shared/config/jwt');

// POST /api/crm/admin/auth/login
const login = async (req, res, next) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;

    if (!adminEmail || !adminHash) {
      return res.status(503).json({
        statusCode: 503,
        error:      'ServiceUnavailable',
        message:    'Admin credentials are not configured on this server',
      });
    }

    const { email, password } = req.body;

    const emailMatch = email === adminEmail;
    const passMatch  = await bcrypt.compare(password, adminHash);

    if (!emailMatch || !passMatch) {
      return res.status(401).json({
        statusCode: 401,
        error:      'Unauthorized',
        message:    'Invalid credentials',
      });
    }

    const token = sign({ sub: adminEmail, role: 'admin' });

    return res.json({
      data: {
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { login };
