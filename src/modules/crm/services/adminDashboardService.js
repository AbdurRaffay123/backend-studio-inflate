'use strict';

const Customer     = require('../models/Customer');
const Consultation = require('../models/Consultation');

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'cancelled'];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const getOverview = async () => {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);

  const [
    totalCustomers,
    totalConsultations,
    statusCounts,
    feeAgg,
    upcomingConsultations,
    recentConsultations,
    recentCustomers,
  ] = await Promise.all([
    Customer.countDocuments({}),
    Consultation.countDocuments({}),
    Consultation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Consultation.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } },
    ]),
    Consultation.find({
      scheduledDate: { $gte: today, $lt: weekEnd },
      status: { $nin: ['completed', 'cancelled'] },
    })
      .sort({ scheduledDate: 1, scheduledTime: 1 })
      .limit(8)
      .lean(),
    Consultation.find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Customer.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
  ]);

  const byStatus = STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  for (const row of statusCounts) {
    if (row && row._id) byStatus[row._id] = row.count;
  }

  return {
    totals: {
      customers: totalCustomers,
      consultations: totalConsultations,
      estimatedConsultationFees: feeAgg[0]?.total || 0,
    },
    byStatus,
    upcomingConsultations,
    recentActivity: [
      ...recentConsultations.map((item) => ({
        type: 'consultation',
        at: item.createdAt,
        consultation: item,
      })),
      ...recentCustomers.map((item) => ({
        type: 'customer',
        at: item.createdAt,
        customer: item,
      })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 8),
  };
};

module.exports = { getOverview };
