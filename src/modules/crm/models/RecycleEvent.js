'use strict';

const { Schema, model } = require('mongoose');

const recycleEventSchema = new Schema(
  {
    shopifyCustomerId: { type: String, required: true, index: true },
    balloonCount:      { type: Number, required: true },
    dropOffDate:       { type: Date,   required: true },
    locationId:        { type: String, default: '' },
    pointsEarned:      { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = model('RecycleEvent', recycleEventSchema);
