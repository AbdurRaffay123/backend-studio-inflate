#!/usr/bin/env node
'use strict';

/**
 * Seed the CRM with demo Customers and Consultations.
 *
 * Usage:
 *   npm run seed:crm
 *   npm run seed:crm -- --reset   # wipe seed records first
 *
 * Idempotency:
 *   Every seeded record is tagged with shopifyCustomerId starting with
 *   "gid://shopify/Customer/SEED-". Re-running upserts customers and skips
 *   duplicate consultations (matched by SEED_KEY in tags).
 */

require('dotenv').config();

const mongoose     = require('mongoose');
const Customer     = require('../src/modules/crm/models/Customer');
const Consultation = require('../src/modules/crm/models/Consultation');

const SEED_PREFIX = 'gid://shopify/Customer/SEED-';
const SEED_TAG    = 'crm-seed-2026';

const RESET = process.argv.includes('--reset');

const customers = [
  {
    shopifyCustomerId: `${SEED_PREFIX}001`,
    email:             'jane.cooper@example.com',
    firstName:         'Jane',
    lastName:          'Cooper',
    phone:             '+14155550101',
    profilePictureUrl: 'https://i.pravatar.cc/300?img=1',
    acceptsMarketing:  true,
    addresses: [
      { address1: '742 Evergreen Terrace', city: 'Springfield', province: 'IL', country: 'US', zip: '62704' },
    ],
    defaultAddress:    { address1: '742 Evergreen Terrace', city: 'Springfield', province: 'IL', country: 'US', zip: '62704' },
    tags:              [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}002`,
    email:             'mark.alvarez@example.com',
    firstName:         'Mark',
    lastName:          'Alvarez',
    phone:             '+14155550102',
    profilePictureUrl: 'https://i.pravatar.cc/300?img=12',
    acceptsMarketing:  false,
    addresses: [
      { address1: '90 Bedford St', city: 'New York', province: 'NY', country: 'US', zip: '10014' },
    ],
    defaultAddress:    { address1: '90 Bedford St', city: 'New York', province: 'NY', country: 'US', zip: '10014' },
    tags:              [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}003`,
    email:             'priya.shah@example.com',
    firstName:         'Priya',
    lastName:          'Shah',
    phone:             '+14155550103',
    profilePictureUrl: 'https://i.pravatar.cc/300?img=47',
    acceptsMarketing:  true,
    addresses: [
      { address1: '1600 Amphitheatre Pkwy', city: 'Mountain View', province: 'CA', country: 'US', zip: '94043' },
    ],
    defaultAddress:    { address1: '1600 Amphitheatre Pkwy', city: 'Mountain View', province: 'CA', country: 'US', zip: '94043' },
    tags:              [SEED_TAG],
  },
];

// Helper to build a date relative to "now"
const daysFromNow = (n, hour = 14, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const consultations = [
  {
    shopifyCustomerId: `${SEED_PREFIX}001`,
    shopifyOrderId:    'gid://shopify/Order/SEED-9001',
    shopifyOrderName:  '#SEED-1042',
    fullName:          'Jane Cooper',
    email:             'jane.cooper@example.com',
    phone:             '+14155550101',

    status: 'new',
    type:   'phone',
    scheduledDate: daysFromNow(7, 10, 30),
    scheduledTime: '10:30',
    duration:      30,
    price:         50,

    intake: {
      eventType:     'Wedding',
      eventDate:     daysFromNow(45, 16, 0),
      eventTime:     '16:00',
      endDate:       daysFromNow(45, 23, 0),
      endTime:       '23:00',
      venueName:     'The Plaza',
      venueType:     'Hotel ballroom',
      venueAddress:  '768 5th Ave, New York, NY 10019',
      setupLocation: 'Grand ballroom, north wing',
      setupDate:     daysFromNow(45, 8, 0),
      setupTime:     '08:00',
      tearDownDate:  daysFromNow(46, 1, 0),
      tearDownTime:  '01:00',
      guestCount:    180,
      services:      ['Balloon arches', 'Table centerpieces', 'Backdrop'],
      budgetRange:   '$5,000–$10,000',
      colorPalette:  'Blush & gold',
      narrative:     'Modern elegant ceremony with garden florals. Looking for arches over the entrance and head table.',
      inspirationPics: [
        'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
        'https://images.unsplash.com/photo-1530023367847-a683933f4172?w=800',
        'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800',
      ],
      additionalNotes: 'Please arrive 30 min early for a venue walk-through.',
    },

    tags: [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}002`,
    shopifyOrderId:    'gid://shopify/Order/SEED-9002',
    shopifyOrderName:  '#SEED-1043',
    fullName:          'Mark Alvarez',
    email:             'mark.alvarez@example.com',
    phone:             '+14155550102',

    status: 'contacted',
    type:   'virtual',
    scheduledDate: daysFromNow(3, 17, 0),
    scheduledTime: '17:00',
    duration:      15,
    price:         25,

    intake: {
      eventType:     'Birthday',
      eventDate:     daysFromNow(20, 18, 30),
      eventTime:     '18:30',
      endDate:       daysFromNow(20, 22, 0),
      endTime:       '22:00',
      venueName:     'Backyard',
      venueType:     'Residential',
      venueAddress:  '90 Bedford St, New York, NY 10014',
      setupLocation: 'Patio + back garden',
      setupDate:     daysFromNow(20, 14, 0),
      setupTime:     '14:00',
      tearDownDate:  daysFromNow(20, 22, 30),
      tearDownTime:  '22:30',
      guestCount:    35,
      services:      ['Balloon column', 'Custom topper'],
      budgetRange:   '$500–$1,000',
      colorPalette:  'Navy & silver',
      narrative:     '40th birthday surprise. Want a tasteful balloon entrance and a table arrangement.',
      inspirationPics: [
        'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800',
        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
      ],
      additionalNotes: 'Wife is allergic to lilies — no fresh flowers please.',
    },

    tags: [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}002`,
    shopifyOrderId:    'gid://shopify/Order/SEED-9003',
    shopifyOrderName:  '#SEED-1044',
    fullName:          'Mark Alvarez',
    email:             'mark.alvarez@example.com',
    phone:             '+14155550102',

    status: 'booked',
    type:   'in_person',
    scheduledDate: daysFromNow(5, 11, 0),
    scheduledTime: '11:00',
    duration:      60,
    price:         100,

    intake: {
      eventType:     'Corporate',
      eventDate:     daysFromNow(28, 9, 0),
      eventTime:     '09:00',
      endDate:       daysFromNow(28, 17, 0),
      endTime:       '17:00',
      venueName:     'Javits Center',
      venueType:     'Convention center',
      venueAddress:  '429 11th Ave, New York, NY 10001',
      setupLocation: 'Booth 4F-22',
      setupDate:     daysFromNow(27, 6, 0),
      setupTime:     '06:00',
      tearDownDate:  daysFromNow(28, 18, 0),
      tearDownTime:  '18:00',
      guestCount:    1200,
      services:      ['10ft inflatable arch', 'Branded pillar', 'Custom signage'],
      budgetRange:   '$10,000+',
      colorPalette:  'Brand red & white',
      narrative:     'Trade show booth — need an oversized inflatable arch with brand logo applied.',
      inspirationPics: [
        'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?w=800',
        'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800',
      ],
      additionalNotes: '',
    },

    tags: [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}003`,
    shopifyOrderId:    null,
    shopifyOrderName:  null,
    fullName:          'Priya Shah',
    email:             'priya.shah@example.com',
    phone:             '+14155550103',

    status: 'new',
    type:   'phone',
    scheduledDate: daysFromNow(2, 9, 15),
    scheduledTime: '09:15',
    duration:      15,
    price:         25,

    intake: {
      eventType:     'Baby shower',
      eventDate:     daysFromNow(35, 13, 0),
      eventTime:     '13:00',
      endDate:       daysFromNow(35, 17, 0),
      endTime:       '17:00',
      venueName:     'Sunset Park Pavilion',
      venueType:     'Outdoor pavilion',
      venueAddress:  '1700 Sunset Pkwy, Las Vegas, NV 89113',
      setupLocation: 'East pavilion (covered)',
      setupDate:     daysFromNow(35, 10, 0),
      setupTime:     '10:00',
      tearDownDate:  daysFromNow(35, 18, 0),
      tearDownTime:  '18:00',
      guestCount:    50,
      services:      ['Balloon garland', 'Photo backdrop'],
      budgetRange:   '$500–$1,000',
      colorPalette:  'Pastel pink, mint, cream',
      narrative:     'Garden-themed baby shower — looking for a soft pastel garland over the dessert table.',
      inspirationPics: [
        'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
        'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800',
      ],
      additionalNotes: 'Outdoor venue — need wind-rated installation.',
    },

    tags: [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}001`,
    shopifyOrderId:    'gid://shopify/Order/SEED-9005',
    shopifyOrderName:  '#SEED-1045',
    fullName:          'Jane Cooper',
    email:             'jane.cooper@example.com',
    phone:             '+14155550101',

    status: 'completed',
    type:   'virtual',
    scheduledDate: daysFromNow(-14, 14, 0),
    scheduledTime: '14:00',
    duration:      30,
    price:         50,

    intake: {
      eventType:     'Anniversary',
      eventDate:     daysFromNow(-2, 19, 0),
      eventTime:     '19:00',
      endDate:       daysFromNow(-2, 23, 0),
      endTime:       '23:00',
      venueName:     'Home',
      venueType:     'Residential',
      venueAddress:  '742 Evergreen Terrace',
      setupLocation: 'Living + dining area',
      setupDate:     daysFromNow(-2, 16, 0),
      setupTime:     '16:00',
      tearDownDate:  daysFromNow(-1, 9, 0),
      tearDownTime:  '09:00',
      guestCount:    20,
      services:      ['Balloon arch'],
      budgetRange:   '$500–$1,000',
      colorPalette:  'Black & gold',
      narrative:     '25th anniversary surprise dinner.',
      inspirationPics: [
        'https://images.unsplash.com/photo-1530023367847-a683933f4172?w=800',
      ],
      additionalNotes: 'Completed successfully — leaving as historical record.',
    },

    tags: [SEED_TAG],
  },
  {
    shopifyCustomerId: `${SEED_PREFIX}003`,
    shopifyOrderId:    null,
    shopifyOrderName:  null,
    fullName:          'Priya Shah',
    email:             'priya.shah@example.com',
    phone:             '+14155550103',

    status: 'cancelled',
    type:   'phone',
    scheduledDate: daysFromNow(-7, 11, 0),
    scheduledTime: '11:00',
    duration:      15,
    price:         25,

    intake: {
      eventType:     'Graduation',
      eventDate:     daysFromNow(60, 17, 0),
      eventTime:     '17:00',
      endDate:       null,
      endTime:       '',
      venueName:     '',
      venueType:     '',
      venueAddress:  '',
      setupLocation: '',
      setupDate:     null,
      setupTime:     '',
      tearDownDate:  null,
      tearDownTime:  '',
      guestCount:    undefined,
      services:      [],
      budgetRange:   '',
      colorPalette:  '',
      narrative:     'Customer cancelled before details were finalised.',
      inspirationPics: [],
      additionalNotes: '',
    },

    tags: [SEED_TAG],
  },
];

const log = (...args) => console.log('[seed]', ...args);

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in environment');
    process.exit(1);
  }

  log('Connecting to MongoDB:', uri);
  await mongoose.connect(uri);

  if (RESET) {
    const cDel = await Customer.deleteMany({ shopifyCustomerId: new RegExp(`^${SEED_PREFIX}`) });
    const sDel = await Consultation.deleteMany({ shopifyCustomerId: new RegExp(`^${SEED_PREFIX}`) });
    log(`--reset: removed ${cDel.deletedCount} customers, ${sDel.deletedCount} consultations`);
  }

  // ── Customers (upsert by shopifyCustomerId) ────────────────────────────
  let createdCustomers = 0;
  let updatedCustomers = 0;
  for (const c of customers) {
    const existing = await Customer.findOne({ shopifyCustomerId: c.shopifyCustomerId });
    if (existing) {
      await Customer.updateOne({ _id: existing._id }, { $set: c });
      updatedCustomers += 1;
    } else {
      await Customer.create(c);
      createdCustomers += 1;
    }
  }
  log(`Customers: ${createdCustomers} created, ${updatedCustomers} updated`);

  // ── Consultations (insert new, skip duplicates by GID + scheduledDate) ──
  let createdConsultations = 0;
  let skippedConsultations = 0;
  const createdIds = [];
  for (const cons of consultations) {
    const dup = await Consultation.findOne({
      shopifyCustomerId: cons.shopifyCustomerId,
      scheduledDate:     cons.scheduledDate,
      type:              cons.type,
    });
    if (dup) {
      skippedConsultations += 1;
      createdIds.push({ id: String(dup._id), status: cons.status, customer: cons.fullName, existing: true });
      continue;
    }
    const doc = await Consultation.create(cons);
    createdConsultations += 1;
    createdIds.push({ id: String(doc._id), status: cons.status, customer: cons.fullName, existing: false });
  }
  log(`Consultations: ${createdConsultations} created, ${skippedConsultations} skipped (duplicates)`);

  // ── Print clickable admin links ─────────────────────────────────────────
  const port = process.env.PORT || 3000;
  console.log('\n──── Open in admin (after starting the server) ────');
  console.log(`  Consultations: http://localhost:${port}/admin/crm-console.html#/consultations`);
  console.log(`  Customers:     http://localhost:${port}/admin/crm-console.html#/customers\n`);

  console.log('Seeded consultation detail pages:');
  for (const c of createdIds) {
    const tag = c.existing ? '(existing)' : '(new)';
    console.log(
      `  [${c.status.padEnd(9)}] ${c.customer.padEnd(14)} ${tag.padEnd(10)} ` +
      `http://localhost:${port}/admin/crm-console.html#/consultations/${c.id}`
    );
  }

  console.log('\nSeeded customer detail pages:');
  for (const c of customers) {
    const encoded = encodeURIComponent(c.shopifyCustomerId);
    console.log(
      `  ${(c.firstName + ' ' + c.lastName).padEnd(16)} ` +
      `http://localhost:${port}/admin/crm-console.html#/customers/${encoded}`
    );
  }

  await mongoose.disconnect();
  log('Done.');
};

main().catch((err) => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
