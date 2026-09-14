import mongoose from 'mongoose';
import EmergencyReport from '../models/EmergencyReport.js';
import User from '../models/User.js';
import { AppError } from '../utils/asyncHandler.js';
import { enqueueForClustering } from './clusteringService.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';
import {
  recomputeRelayCount,
  toEmergencyReportDto,
} from './emergencyReportDto.js';
import {
  CryptoMaterialError,
  canonicalEmergencyCloudBytes,
  fingerprintPublicKey,
  verifyEmergencyCloudSignature,
} from '../security/emergencyCanonical.js';

/** Allow limited future skew for device clock drift. */
const FUTURE_SKEW_MS =
  Number(process.env.REPORT_TIMESTAMP_FUTURE_SKEW_MS) || 15 * 60 * 1000;
/** Extra slack after signed TTL so DTN store-and-forward retries still land. */
const TTL_SKEW_MS =
  Number(process.env.REPORT_TTL_SKEW_MS) || 15 * 60 * 1000;
const MAX_HOP_COUNT = 5;
const COORD_EPSILON = 1e-7;

const toReportDto = toEmergencyReportDto;

const fail = (message, statusCode, code) => {
  const err = new AppError(message, statusCode);
  err.code = code;
  throw err;
};

const assertValidObjectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    fail(`${field} must be a valid id`, 400, 'INVALID_ID');
  }
};

const normalizeHopCount = (hopCount) => {
  if (hopCount === undefined || hopCount === null) return 0;
  const n = Number(hopCount);
  if (!Number.isFinite(n) || n < 0) {
    fail('hopCount must be a non-negative integer', 400, 'INVALID_HOP');
  }
  return Math.floor(n);
};

const assertHopWithinLimit = (hopCount) => {
  if (hopCount > MAX_HOP_COUNT) {
    fail(`hopCount exceeds max hop (${MAX_HOP_COUNT})`, 400, 'INVALID_HOP');
  }
  return hopCount;
};

const assertSignedCoordinates = (location, latitudeCanonical, longitudeCanonical) => {
  const lat = Number(latitudeCanonical);
  const lng = Number(longitudeCanonical);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    fail('signed coordinates are invalid', 400, 'INVALID_COORDINATES');
  }
  const [geoLng, geoLat] = location.coordinates;
  if (
    Math.abs(lat - geoLat) > COORD_EPSILON ||
    Math.abs(lng - geoLng) > COORD_EPSILON
  ) {
    fail(
      'location does not match signed coordinates',
      400,
      'LOCATION_MISMATCH'
    );
  }
  return { latitude: lat, longitude: lng };
};

const assertTimestampMatchesCreatedAt = (timestamp, createdAtMs) => {
  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) {
    fail('timestamp is invalid', 400, 'INVALID_TIMESTAMP');
  }
  if (Math.abs(ts.getTime() - Number(createdAtMs)) > 1000) {
    fail('timestamp does not match createdAtMs', 400, 'INVALID_TIMESTAMP');
  }
};

/**
 * Authenticated TTL: createdAtMs + ttl come from verified canonical bytes.
 * DTN expiry is timestamp+ttl; cloud allows TTL_SKEW_MS of clock drift.
 */
const assertAuthenticatedTtl = (createdAtMs, ttl, now = Date.now()) => {
  const created = Number(createdAtMs);
  const ttlMs = Number(ttl);
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    fail('ttl must be a positive integer', 400, 'INVALID_TTL');
  }
  if (created - now > FUTURE_SKEW_MS) {
    fail(
      `timestamp is too far in the future (max skew ${Math.round(FUTURE_SKEW_MS / 60000)}m)`,
      400,
      'INVALID_TIMESTAMP'
    );
  }
  if (now > created + ttlMs + TTL_SKEW_MS) {
    fail('emergency has expired', 400, 'EMERGENCY_EXPIRED');
  }
  return new Date(created);
};

const assertSameOriginalSender = (existing, originalSenderId) => {
  if (String(existing.originalSenderId) !== String(originalSenderId)) {
    fail(
      'messageId already bound to a different original sender',
      409,
      'PROVENANCE_MISMATCH'
    );
  }
};

const mergeDuplicateUpload = async (existing, uploaderId, hopCount) => {
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

const resolveOriginUser = async (senderPublicKey, claimedOriginalSenderId) => {
  const key = String(senderPublicKey).trim();
  const fingerprint = fingerprintPublicKey(key);
  const originUser = await User.findOne({
    $or: [{ publicKey: key }, { publicKeyFingerprint: fingerprint }],
  });
  if (!originUser) {
    fail(
      'original sender is not a registered backend identity',
      422,
      'ORIGIN_NOT_REGISTERED'
    );
  }
  if (String(originUser.publicKey || '').trim() !== key) {
    fail(
      'senderPublicKey does not match original sender identity',
      403,
      'PROVENANCE_MISMATCH'
    );
  }
  if (claimedOriginalSenderId) {
    assertValidObjectId(claimedOriginalSenderId, 'originalSenderId');
    if (String(originUser._id) !== String(claimedOriginalSenderId)) {
      fail(
        'originalSenderId does not match verified signing identity',
        403,
        'PROVENANCE_MISMATCH'
      );
    }
  }
  return originUser;
};

/**
 * Offline→online relay upload.
 *
 * Validation order:
 * 1. Relay JWT (middleware) — uploaderId is always the authenticated user
 * 2. Request schema (middleware)
 * 3. Reconstruct metadata canonical + verify Ed25519
 * 4. Authenticated createdAtMs / TTL
 * 5. Derive original sender from verified public key (never trust unsigned ids)
 * 6. messageId uniqueness + unique index race handling
 * 7. Persist exactly one EmergencyReport; uploaderId stays distinct from origin
 *
 * Origin with no backend user: 422 ORIGIN_NOT_REGISTERED (explicit; not dropped).
 */
export const uploadEmergencyReport = async (payload, authenticatedUserId) => {
  const {
    messageId,
    originalSenderId: claimedOriginalSenderId,
    uploaderId: claimedUploaderId,
    emergencyType,
    severity,
    location,
    timestamp,
    hopCount: rawHopCount,
    senderId,
    createdAtMs,
    ttl,
    radiusCanonical,
    latitudeCanonical,
    longitudeCanonical,
    batteryPercentage,
    senderPublicKey,
    signature,
  } = payload;

  const uploaderId = String(authenticatedUserId);
  assertValidObjectId(uploaderId, 'uploaderId');
  if (String(claimedUploaderId) !== uploaderId) {
    fail('uploaderId must match the authenticated user', 403, 'UPLOADER_MISMATCH');
  }

  const hopCount = normalizeHopCount(rawHopCount);
  assertSignedCoordinates(location, latitudeCanonical, longitudeCanonical);
  assertTimestampMatchesCreatedAt(timestamp, createdAtMs);

  let canonicalBytes;
  let signatureOk;
  try {
    canonicalBytes = canonicalEmergencyCloudBytes({
      messageId,
      senderId,
      createdAtMs,
      ttl,
      radiusCanonical,
      severity,
      emergencyType,
      latitudeCanonical,
      longitudeCanonical,
      batteryPercentage,
      senderPublicKey,
    });
    signatureOk = verifyEmergencyCloudSignature({
      canonicalBytes,
      signature,
      senderPublicKey,
    });
  } catch (err) {
    if (err instanceof CryptoMaterialError) {
      fail(err.message, 400, 'MALFORMED_CRYPTO');
    }
    fail('emergency signature is invalid', 400, 'INVALID_SIGNATURE');
  }
  if (!signatureOk) {
    fail('emergency signature is invalid', 400, 'INVALID_SIGNATURE');
  }

  const originUser = await resolveOriginUser(
    senderPublicKey,
    claimedOriginalSenderId
  );
  const originalSenderId = String(originUser._id);

  const existing = await EmergencyReport.findOne({ messageId });
  if (existing) {
    assertSameOriginalSender(existing, originalSenderId);
    return mergeDuplicateUpload(
      existing,
      uploaderId,
      Math.min(hopCount, MAX_HOP_COUNT)
    );
  }

  assertHopWithinLimit(hopCount);
  const normalizedTimestamp = assertAuthenticatedTtl(createdAtMs, ttl);
  const now = new Date();
  const uploaderOid = new mongoose.Types.ObjectId(uploaderId);
  const originOid = new mongoose.Types.ObjectId(originalSenderId);
  const uploaders = [uploaderOid];
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
      location: {
        type: 'Point',
        coordinates: [Number(longitudeCanonical), Number(latitudeCanonical)],
      },
      timestamp: normalizedTimestamp,
      clusterId: null,
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.messageId) {
      const raced = await EmergencyReport.findOne({ messageId });
      if (raced) {
        assertSameOriginalSender(raced, originalSenderId);
        return mergeDuplicateUpload(
          raced,
          uploaderId,
          Math.min(hopCount, MAX_HOP_COUNT)
        );
      }
    }
    throw err;
  }

  emitToAdmin(AdminSocketEvents.REPORT_CREATED, {
    report: toReportDto(report),
  });

  await enqueueForClustering(report);
  const linked = await EmergencyReport.findById(report._id);

  return {
    report: toReportDto(linked || report),
    created: true,
    deduplicated: false,
  };
};
