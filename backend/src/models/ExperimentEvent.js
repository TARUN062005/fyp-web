import mongoose from 'mongoose';
import {
  EXPERIMENT_EVENT_TYPES,
  EXPERIMENT_SCENARIOS,
} from '../config/experimentConstants.js';

const experimentEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    experimentId: {
      type: String,
      required: true,
      index: true,
    },
    trialId: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      enum: EXPERIMENT_EVENT_TYPES,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meshUserId: {
      type: String,
      default: '',
    },
    wallClockMs: {
      type: Number,
      required: true,
    },
    elapsedRealtimeMs: {
      type: Number,
      default: null,
    },
    clockOffsetMs: {
      type: Number,
      default: null,
    },
    clockUncertaintyMs: {
      type: Number,
      default: null,
    },
    scenario: {
      type: String,
      enum: EXPERIMENT_SCENARIOS,
      required: true,
    },
    hopCount: {
      type: Number,
      default: null,
    },
    maxHopCount: {
      type: Number,
      default: null,
    },
    sourceDeviceId: {
      type: String,
      default: null,
    },
    destinationDeviceId: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    extra: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },
  { timestamps: true }
);

experimentEventSchema.index({ experimentId: 1, trialId: 1, wallClockMs: 1 });
experimentEventSchema.index({ experimentId: 1, eventType: 1 });
experimentEventSchema.index({ experimentId: 1, createdAt: -1 });

export default mongoose.model('ExperimentEvent', experimentEventSchema);
