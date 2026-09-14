import mongoose from 'mongoose';
import User from '../models/User.js';
import { AppError } from '../utils/asyncHandler.js';
import {
  AdminSocketEvents,
  emitToAdmin,
  emitToRadarRoom,
} from './adminRealtime.js';
import {
  collectStatusTransitions,
  getRadarGateway,
  listRadarGateways,
  putRadarSnapshot,
} from './radarGatewayStore.js';

const MAX_CAPTURE_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

let freshnessTimer = null;

const toIso = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return d.toISOString();
};

const sanitizePeer = (peer) => ({
  peerId: String(peer.peerId),
  emergencyId: peer.emergencyId ? String(peer.emergencyId) : null,
  displayName: String(peer.displayName).slice(0, 80),
  connectionState: peer.connectionState,
  distanceMeters: Number(peer.distanceMeters),
  beyondRadarRange: Boolean(peer.beyondRadarRange),
  angleDegrees: Number(peer.angleDegrees),
  lastSeen: peer.lastSeen ? toIso(peer.lastSeen) : null,
});

const statusPayload = (record) => ({
  gatewayUserId: record.gatewayUserId,
  displayName: record.displayName,
  emergencyId: record.emergencyId,
  status: record.status,
  lastUpdatedAt: record.lastUpdatedAt,
  sequence: record.sequence,
  peerCount: record.peerCount,
  angleKind: record.angleKind,
});

/**
 * Live Radar snapshots. A mobile user becomes a gateway only while this
 * process holds a recently published snapshot for their authenticated JWT
 * user id. observerId spoofs are rejected. No durable gateway flag and no
 * Mongo snapshot history — lastUpdatedAt drives LIVE / STALE / OFFLINE.
 */
export const publishRadarSnapshot = async (body, authenticatedUserId) => {
  if (body.observerId && String(body.observerId) !== String(authenticatedUserId)) {
    throw new AppError('observerId must match the authenticated gateway', 403);
  }

  const captured = new Date(body.capturedAt);
  if (Number.isNaN(captured.getTime())) {
    throw new AppError('capturedAt is invalid', 400);
  }
  const now = Date.now();
  if (now - captured.getTime() > MAX_CAPTURE_AGE_MS) {
    throw new AppError('radar snapshot is too old', 400);
  }
  if (captured.getTime() - now > MAX_FUTURE_SKEW_MS) {
    throw new AppError('capturedAt is too far in the future', 400);
  }

  const user = await User.findById(authenticatedUserId).select(
    'displayName emergencyId isBlocked'
  );
  if (!user) {
    throw new AppError('gateway user not found', 401);
  }
  if (user.isBlocked) {
    throw new AppError('Account is blocked', 403);
  }

  const peers = (body.peers || []).map(sanitizePeer);
  const result = putRadarSnapshot({
    gatewayUserId: String(authenticatedUserId),
    displayName: user.displayName,
    emergencyId: user.emergencyId,
    sequence: body.sequence,
    capturedAt: captured.toISOString(),
    radarRangeMeters: body.radarRangeMeters,
    angleKind: body.angleKind || 'VISUAL_SECTOR',
    peers,
  });

  if (!result.ok) {
    throw new AppError('radar sequence is stale', 409);
  }

  emitToAdmin(AdminSocketEvents.RADAR_GATEWAY_STATUS, statusPayload(result.record));
  if (!result.duplicate) {
    emitToRadarRoom(
      result.record.gatewayUserId,
      AdminSocketEvents.RADAR_GATEWAY_UPDATED,
      result.record
    );
  }

  return {
    accepted: true,
    duplicate: Boolean(result.duplicate),
    gateway: statusPayload(result.record),
  };
};

export const listAdminRadarGateways = () => ({
  gateways: listRadarGateways(),
});

export const getAdminRadarGateway = (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new AppError('gateway userId is invalid', 400);
  }
  const record = getRadarGateway(userId);
  if (!record) {
    throw new AppError('gateway radar not found', 404);
  }
  return record;
};

export const startRadarFreshnessMonitor = () => {
  if (freshnessTimer) return;
  freshnessTimer = setInterval(() => {
    const changed = collectStatusTransitions();
    changed.forEach((record) => {
      emitToAdmin(AdminSocketEvents.RADAR_GATEWAY_STATUS, statusPayload(record));
      emitToRadarRoom(
        record.gatewayUserId,
        AdminSocketEvents.RADAR_GATEWAY_STATUS,
        statusPayload(record)
      );
    });
  }, 5_000);
  if (typeof freshnessTimer.unref === 'function') {
    freshnessTimer.unref();
  }
};

export const stopRadarFreshnessMonitor = () => {
  if (freshnessTimer) {
    clearInterval(freshnessTimer);
    freshnessTimer = null;
  }
};
