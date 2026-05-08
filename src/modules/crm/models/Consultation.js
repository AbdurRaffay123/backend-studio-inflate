'use strict';

const { Schema, model, Types } = require('mongoose');

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'cancelled'];
const TYPES    = ['phone', 'virtual', 'in_person'];

const internalNoteSchema = new Schema(
  {
    text:    { type: String, required: true },
    addedBy: { type: String, default: 'admin' },
    addedAt: { type: Date,   default: () => new Date() },
  },
  { _id: true }
);

const intakeSchema = new Schema(
  {
    eventType:        { type: String, default: '' },
    eventDate:        { type: Date   },
    eventTime:        { type: String, default: '' },
    venueName:        { type: String, default: '' },
    venueAddress:     { type: String, default: '' },
    guestCount:       { type: Number },
    services:         { type: [String], default: [] },
    budgetRange:      { type: String, default: '' },
    colorPalette:     { type: String, default: '' },
    narrative:        { type: String, default: '' },
    inspirationPics:  { type: [String], default: [] },
    additionalNotes:  { type: String, default: '' },
  },
  { _id: false }
);

const consultationSchema = new Schema(
  {
    shopifyCustomerId: { type: String, required: true, index: true },
    shopifyOrderId:    { type: String, default: null },
    shopifyOrderName:  { type: String, default: null },

    status:   { type: String, enum: STATUSES, default: 'new', index: true },
    type:     { type: String, enum: TYPES,    required: true },

    scheduledDate: { type: Date   },
    scheduledTime: { type: String, default: '' },
    duration:      { type: Number, enum: [15, 30, 60] },
    price:         { type: Number, enum: [25, 50, 100] },

    intake: { type: intakeSchema, default: () => ({}) },

    internalNotes:    { type: [internalNoteSchema], default: [] },
    assignedArtistId: { type: Types.ObjectId, default: null, ref: 'Artist' },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// 1. shopifyCustomerId            → declared inline on the field (lookup by customer)
// 2. status                       → declared inline on the field (filter by status)
// 3. (status, createdAt -1)       → admin list, default sort
consultationSchema.index({ status: 1, createdAt: -1 });
// 4. (assignedArtistId, status)   → artist's pipeline view (when artists go live)
consultationSchema.index({ assignedArtistId: 1, status: 1 });
// 5. (assignedArtistId, scheduledDate) → artist's calendar view
consultationSchema.index({ assignedArtistId: 1, scheduledDate: 1 });
// 6. shopifyOrderId               → reverse lookup from a Shopify order webhook
consultationSchema.index({ shopifyOrderId: 1 });
// 7. createdAt -1                 → fast "recent activity" feed across all statuses
consultationSchema.index({ createdAt: -1 });
// 8. (status, shopifyCustomerId)  → "open consultations for this customer"
consultationSchema.index({ status: 1, shopifyCustomerId: 1 });

module.exports = model('Consultation', consultationSchema);
