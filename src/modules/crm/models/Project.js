'use strict';

const { Schema, model, Types } = require('mongoose');

const PROJECT_STATUSES = [
  'pending',      // consultation booked, project not yet started
  'in_progress',  // artist assigned, work underway
  'review',       // deliverables submitted, awaiting client approval
  'completed',    // approved and paid in full
  'cancelled',    // project cancelled before completion
];

const noteSchema = new Schema(
  {
    text:    { type: String, required: true },
    addedBy: { type: String, default: 'admin' },
    addedAt: { type: Date,   default: () => new Date() },
  },
  { _id: true }
);

const deliverableSchema = new Schema(
  {
    title:       { type: String, required: true },
    description: { type: String, default: '' },
    fileUrl:     { type: String, default: null },
    uploadedAt:  { type: Date,   default: () => new Date() },
  },
  { _id: true }
);

const projectSchema = new Schema(
  {
    // ── Key references ──────────────────────────────────────────────────────
    shopifyCustomerId: { type: String, required: true, index: true },
    consultationId: {
      type: Types.ObjectId,
      ref: 'Consultation',
      default: null,
    },
    assignedArtistId: {
      type: Types.ObjectId,
      ref: 'Artist',
      default: null,
      index: true,
    },

    // ── Core project details ────────────────────────────────────────────────
    title:       { type: String, default: '' },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: 'pending',
      index: true,
    },

    // ── Event / delivery dates ──────────────────────────────────────────────
    eventDate:    { type: Date, default: null },
    dueDate:      { type: Date, default: null },
    completedAt:  { type: Date, default: null },

    // ── Budget ──────────────────────────────────────────────────────────────
    estimatedBudget: { type: Number, default: null },
    actualCost:      { type: Number, default: null },

    // ── Files / deliverables ────────────────────────────────────────────────
    deliverables: { type: [deliverableSchema], default: [] },

    // ── Admin notes ─────────────────────────────────────────────────────────
    internalNotes: { type: [noteSchema], default: [] },

    // ── Tags for future filtering ───────────────────────────────────────────
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// shopifyCustomerId, status, consultationId, assignedArtistId declared inline
projectSchema.index({ status: 1, createdAt: -1 });                      // admin list default sort
projectSchema.index({ assignedArtistId: 1, status: 1 });                // artist pipeline
projectSchema.index({ assignedArtistId: 1, eventDate: 1 });             // artist calendar
projectSchema.index({ shopifyCustomerId: 1, status: 1 });               // customer's open projects
projectSchema.index({ consultationId: 1 }, { unique: true, sparse: true }); // one project per consultation

module.exports = model('Project', projectSchema);
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
