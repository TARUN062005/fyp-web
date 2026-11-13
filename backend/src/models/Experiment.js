import mongoose from 'mongoose';
import {
  EXPERIMENT_SCENARIOS,
  EXPERIMENT_STATUSES,
  MEASUREMENT_KIND_PHYSICAL,
} from '../config/experimentConstants.js';

const experimentSchema = new mongoose.Schema(
  {
    experimentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    scenario: {
      type: String,
      enum: EXPERIMENT_SCENARIOS,
      required: true,
    },
    participantCount: {
      type: Number,
      required: true,
      min: 2,
      max: 8,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: EXPERIMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    measurementKind: {
      type: String,
      default: MEASUREMENT_KIND_PHYSICAL,
      enum: [MEASUREMENT_KIND_PHYSICAL],
    },
    appVersion: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

experimentSchema.index({ createdByUserId: 1, createdAt: -1 });
experimentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Experiment', experimentSchema);
