import mongoose from 'mongoose';
import geoPointSchema from './schemas/geoPoint.js';
import {
  EMERGENCY_TYPE_VALUES,
  SEVERITY_VALUES,
} from '../config/emergencyEnums.js';

export const VERIFICATION_STATUS_VALUES = [
  'UNVERIFIED',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
  'FALSE_REPORT',
];

export const REPORT_SYNC_STATUS_VALUES = [
  'PENDING_CONSENSUS',
  'SYNCED',
];

const emergencyReportSchema = new mongoose.Schema(
  {
    // Idempotency key for duplicate-safe uploads
    messageId: {
      type: String,
      required: true,
      trim: true,
    },
    originalSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** First uploader (legacy field; also always present in uploaders[]). */
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    uploaders: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
    },
    uploadCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    /** Successful uploads where uploader ≠ originalSender. */
    relayCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    hopCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstUploadedAt: {
      type: Date,
      default: null,
    },
    lastUploadedAt: {
      type: Date,
      default: null,
    },
    syncStatus: {
      type: String,
      enum: REPORT_SYNC_STATUS_VALUES,
      default: 'PENDING_CONSENSUS',
      index: true,
    },
    trueVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    falseVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    unknownVotes: {
      type: Number,
      default: 0,
      min: 0,
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUS_VALUES,
      default: 'UNVERIFIED',
      index: true,
    },
    emergencyType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: EMERGENCY_TYPE_VALUES,
      index: true,
    },
    severity: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: SEVERITY_VALUES,
      index: true,
    },
    location: {
      type: geoPointSchema,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    // Nullable until clustering assigns a cluster
    clusterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmergencyCluster',
      default: null,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'emergency_reports',
  }
);

emergencyReportSchema.index({ messageId: 1 }, { unique: true });
emergencyReportSchema.index({ location: '2dsphere' });

const EmergencyReport = mongoose.model('EmergencyReport', emergencyReportSchema);

export default EmergencyReport;
