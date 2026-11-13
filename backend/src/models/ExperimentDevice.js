import mongoose from 'mongoose';
import { EXPERIMENT_ROLES } from '../config/experimentConstants.js';

const experimentDeviceSchema = new mongoose.Schema(
  {
    experimentId: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    meshUserId: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    androidVersion: {
      type: String,
      trim: true,
      default: '',
    },
    appVersion: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      enum: EXPERIMENT_ROLES,
      required: true,
    },
    clockOffsetMs: {
      type: Number,
      default: null,
    },
    clockUncertaintyMs: {
      type: Number,
      default: null,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

experimentDeviceSchema.index(
  { experimentId: 1, deviceId: 1 },
  { unique: true }
);
experimentDeviceSchema.index({ experimentId: 1, userId: 1 });

export default mongoose.model('ExperimentDevice', experimentDeviceSchema);
