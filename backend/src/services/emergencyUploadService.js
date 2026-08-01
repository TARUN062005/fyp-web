import mongoose from 'mongoose';
import EmergencyReport from '../models/EmergencyReport.js';
import { AppError } from '../utils/asyncHandler.js';
import { enqueueForClustering } from './clusteringService.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';

/** Reject reports older than this (Android emergency TTL / relay freshness). */
const MAX_AGE_MS = Number(process.env.REPORT_TIMESTAMP_MAX_AGE_MS) || 48 * 60 * 60 * 1000;
/** Allow limited future skew for device clock drift. */
const FUTURE_SKEW_MS =
  Number(process.env.REPORT_TIMESTAMP_FUTURE_SKEW_MS) || 15 * 60 * 1000;

const toReportDto = (report) => ({
  id: String(report._id),
  messageId: report.messageId,
  originalSenderId: String(report.originalSenderId),
  uploaderId: String(report.uploaderId),
  emergencyType: report.emergencyType,
  severity: report.severity,
  location: report.location,
  timestamp: report.timestamp,
  clusterId: report.clusterId ? String(report.clusterId) : null,
  createdAt: report.createdAt,
});

const assertValidObjectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`${field} must be a valid id`, 400);
  }
};

const assertTimestampWindow = (timestamp) => {
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) {
    throw new AppError('timestamp is invalid', 400);
  }

  const now = Date.now();
  const ageMs = now - ts.getTime();

  if (ageMs > MAX_AGE_MS) {
    throw new AppError(
      `timestamp is too old (max age ${Math.round(MAX_AGE_MS / 3600000)}h)`,
      400
    );
  }

  if (ts.getTime() - now > FUTURE_SKEW_MS) {
    throw new AppError(
      `timestamp is too far in the future (max skew ${Math.round(FUTURE_SKEW_MS / 60000)}m)`,
      400
    );
  }

  return ts;
};

/**
 * Offline→online relay upload.
 *
 * Replay / duplicate protection (B6 + B10):
 * 1. messageId uniqueness — lookup + unique index; duplicates return the
 *    existing report (idempotent), never a second document.
 * 2. timestamp window — reject if older than REPORT_TIMESTAMP_MAX_AGE_MS
 *    (default 48h) or more than REPORT_TIMESTAMP_FUTURE_SKEW_MS ahead
 *    (default 15m).
 */
export const uploadEmergencyReport = async (payload, authenticatedUserId) => {
  const {
    messageId,
    originalSenderId,
    uploaderId,
    emergencyType,
    severity,
    location,
    timestamp,
  } = payload;

  assertValidObjectId(originalSenderId, 'originalSenderId');
  assertValidObjectId(uploaderId, 'uploaderId');

  if (String(uploaderId) !== String(authenticatedUserId)) {
    throw new AppError('uploaderId must match the authenticated user', 403);
  }

  const existing = await EmergencyReport.findOne({ messageId });
  if (existing) {
    return {
      report: toReportDto(existing),
      created: false,
      deduplicated: true,
    };
  }

  const normalizedTimestamp = assertTimestampWindow(timestamp);

  let report;
  try {
    report = await EmergencyReport.create({
      messageId,
      originalSenderId,
      uploaderId,
      emergencyType,
      severity,
      location,
      timestamp: normalizedTimestamp,
      clusterId: null,
    });
  } catch (err) {
    // Race: another relay inserted the same messageId first
    if (err?.code === 11000 && err?.keyPattern?.messageId) {
      const raced = await EmergencyReport.findOne({ messageId });
      if (raced) {
        return {
          report: toReportDto(raced),
          created: false,
          deduplicated: true,
        };
      }
    }
    throw err;
  }

  emitToAdmin(AdminSocketEvents.REPORT_CREATED, {
    report: toReportDto(report),
  });

  await enqueueForClustering(report);
  // Reload so response includes the assigned clusterId
  const linked = await EmergencyReport.findById(report._id);

  return {
    report: toReportDto(linked || report),
    created: true,
    deduplicated: false,
  };
};
