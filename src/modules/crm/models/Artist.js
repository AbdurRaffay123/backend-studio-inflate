'use strict';

const { Schema, model } = require('mongoose');

const artistSchema = new Schema(
  {
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true },
    phone:        { type: String, default: '' },
    specialties:  { type: [String], default: [] },
    status:       { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = model('Artist', artistSchema);
