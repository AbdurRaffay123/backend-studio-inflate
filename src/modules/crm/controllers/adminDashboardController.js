'use strict';

const dashboardService = require('../services/adminDashboardService');

// GET /api/crm/admin/dashboard
const overview = async (req, res, next) => {
  try {
    const data = await dashboardService.getOverview();
    return res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports = { overview };
