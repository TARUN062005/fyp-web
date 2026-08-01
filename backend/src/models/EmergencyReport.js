import mongoose from 'mongoose';
import geoPointSchema from './schemas/geoPoint.js';
import {
  EMERGENCY_TYPE_VALUES,
  SEVERITY_VALUES,
} from '../config/emergencyEnums.js';

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
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
