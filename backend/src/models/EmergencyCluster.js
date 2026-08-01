import mongoose from 'mongoose';
import geoPointSchema from './schemas/geoPoint.js';
import {
  EMERGENCY_TYPE_VALUES,
  SEVERITY_VALUES,
} from '../config/emergencyEnums.js';

const CLUSTER_STATUS = ['unverified', 'verified', 'resolved'];

const emergencyClusterSchema = new mongoose.Schema(
  {
    clusterId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^CLUSTER-[A-Z0-9]+$/, 'clusterId must match CLUSTER-XXX'],
    },
    emergencyType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: EMERGENCY_TYPE_VALUES,
      index: true,
    },
    location: {
      type: geoPointSchema,
      required: true,
    },
    severity: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      enum: SEVERITY_VALUES,
      index: true,
    },
    reportCount: {
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
    firstReportAt: {
      type: Date,
      required: true,
    },
    lastReportAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: CLUSTER_STATUS,
      default: 'unverified',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'emergency_clusters',
  }
);

emergencyClusterSchema.index({ clusterId: 1 }, { unique: true });
emergencyClusterSchema.index({ location: '2dsphere' });

const EmergencyCluster = mongoose.model(
  'EmergencyCluster',
  emergencyClusterSchema
);

export default EmergencyCluster;
export { CLUSTER_STATUS };
