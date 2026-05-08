'use strict';

const { Schema, model } = require('mongoose');

const noteSchema = new Schema(
  {
    text:    { type: String, required: true },
    addedBy: { type: String, default: 'admin' },
    addedAt: { type: Date,   default: () => new Date() },
  },
  { _id: true }
);

const customerSchema = new Schema(
  {
    shopifyCustomerId: { type: String, required: true, unique: true, index: true },
    email:             { type: String, required: true },
    firstName:         { type: String, default: '' },
    lastName:          { type: String, default: '' },
    phone:             { type: String, default: '' },
    profilePictureUrl: { type: String, default: '' },
    acceptsMarketing:  { type: Boolean, default: false },
    addresses:         { type: [Schema.Types.Mixed], default: [] },
    defaultAddress:    { type: Schema.Types.Mixed, default: null },
    memberSince:       { type: Date,   default: () => new Date() },
    tags:              { type: [String], default: [] },
    notes:             { type: [noteSchema], default: [] },
  },
  { timestamps: true }
);

customerSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

module.exports = model('Customer', customerSchema);
