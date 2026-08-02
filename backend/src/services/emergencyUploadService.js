import mongoose from 'mongoose';
import EmergencyReport from '../models/EmergencyReport.js';
import { AppError } from '../utils/asyncHandler.js';
import { enqueueForClustering } from './clusteringService.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';
import {
  recomputeRelayCount,
  toEmergencyReportDto,
} from './emergencyReportDto.js';

/** Reject reports older than this (Android emergency TTL / relay freshness). */
const MAX_AGE_MS = Number(process.env.REPORT_TIMESTAMP_MAX_AGE_MS) || 48 * 60 * 60 * 1000;
/** Allow limited future skew for device clock drift. */
const FUTURE_SKEW_MS =
  Number(process.env.REPORT_TIMESTAMP_FUTURE_SKEW_MS) || 15 * 60 * 1000;

const toReportDto = toEmergencyReportDto;

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

const normalizeHopCount = (hopCount) => {
  if (hopCount === undefined || hopCount === null) return 0;
  const n = Number(hopCount);
  if (!Number.isFinite(n) || n < 0) {
    throw new AppError('hopCount must be a non-negative integer', 400);
  }
  return Math.floor(n);
};

/**
 * Merge a duplicate upload into an existing report (no second document).
 */
const mergeDuplicateUpload = async (existing, uploaderId, hopCount) => {
  const uploaderOid = new mongoose.Types.ObjectId(String(uploaderId));
  const uploaderSet = new Set(
    (existing.uploaders || []).map((id) => String(id))
  );
  uploaderSet.add(String(uploaderId));
  if (existing.uploaderId) {
    uploaderSet.add(String(existing.uploaderId));
  }
  const uploaders = [...uploaderSet].map(
    (id) => new mongoose.Types.ObjectId(id)
  );
  const uploadCount = uploaders.length;
  const relayCount = recomputeRelayCount(uploaders, existing.originalSenderId);
  const nextHop = Math.max(Number(existing.hopCount) || 0, hopCount);
  const now = new Date();

  existing.uploaders = uploaders;
  existing.uploadCount = uploadCount;
  existing.relayCount = relayCount;
  existing.hopCount = nextHop;
  existing.lastUploadedAt = now;
  if (!existing.firstUploadedAt) {
    existing.firstUploadedAt = existing.createdAt || now;
  }
  // Keep first uploaderId as historical first uploader
  await existing.save();

  emitToAdmin(AdminSocketEvents.REPORT_UPDATED, {
    report: toReportDto(existing),
  });

  return {
    report: toReportDto(existing),
    created: false,
    deduplicated: true,
  };
};

/**
 * Offline→online relay upload.
 *
 * Replay / duplicate protection:
 * 1. messageId uniqueness — lookup + unique index; duplicates merge counters
 *    (uploaders, uploadCount, relayCount, hopCount) — never a second document.
 * 2. timestamp window — reject if older than REPORT_TIMESTAMP_MAX_AGE_MS
 *    (default 48h) or more than REPORT_TIMESTAMP_FUTURE_SKEW_MS ahead
 *    (default 15m). Applied on create only.
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
    hopCount: rawHopCount,
  } = payload;

  assertValidObjectId(originalSenderId, 'originalSenderId');
  assertValidObjectId(uploaderId, 'uploaderId');

  if (String(uploaderId) !== String(authenticatedUserId)) {
    throw new AppError('uploaderId must match the authenticated user', 403);
  }

  const hopCount = normalizeHopCount(rawHopCount);

  const existing = await EmergencyReport.findOne({ messageId });
  if (existing) {
    return mergeDuplicateUpload(existing, uploaderId, hopCount);
  }

  const normalizedTimestamp = assertTimestampWindow(timestamp);
  const now = new Date();
  const uploaderOid = new mongoose.Types.ObjectId(String(uploaderId));
  const originOid = new mongoose.Types.ObjectId(String(originalSenderId));
  const uploaders = [uploaderOid];
  if (String(uploaderId) !== String(originalSenderId)) {
    // Origin may not be in uploaders yet if only a relay uploaded
  }
  const relayCount = recomputeRelayCount(uploaders, originalSenderId);

  let report;
  try {
    report = await EmergencyReport.create({
      messageId,
      originalSenderId: originOid,
      uploaderId: uploaderOid,
      uploaders,
      uploadCount: uploaders.length,
      relayCount,
      hopCount,
      firstUploadedAt: now,
      lastUploadedAt: now,
      syncStatus: 'PENDING_CONSENSUS',
      trueVotes: 0,
      falseVotes: 0,
      unknownVotes: 0,
      confidenceScore: 0,
      verificationStatus: 'UNVERIFIED',
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
        return mergeDuplicateUpload(raced, uploaderId, hopCount);
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
