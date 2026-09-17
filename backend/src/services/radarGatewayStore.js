/**
 * Ephemeral in-memory radar gateway state.
 * Not written to MongoDB — live operational snapshots only.
 *
 * Limitation: a multi-instance Render deploy would not share this map.
 * This project runs a single backend process.
 */

export const RADAR_STALE_MS = 20_000;
export const RADAR_OFFLINE_MS = 60_000;
export const RADAR_PRUNE_MS = 10 * 60 * 1000;
export const RADAR_MAX_PEERS = 40;

const gateways = new Map();

export const resetRadarStore = () => {
  gateways.clear();
};

export const computeRadarStatus = (lastUpdatedAt, now = Date.now()) => {
  const ts = new Date(lastUpdatedAt).getTime();
  if (!Number.isFinite(ts)) return 'OFFLINE';
  const age = now - ts;
  if (age > RADAR_OFFLINE_MS) return 'OFFLINE';
  if (age > RADAR_STALE_MS) return 'STALE';
  return 'LIVE';
};

const toPublicRecord = (record, now = Date.now()) => {
  const status = computeRadarStatus(record.lastUpdatedAt, now);
  return {
    gatewayUserId: record.gatewayUserId,
    displayName: record.displayName,
    emergencyId: record.emergencyId,
    status,
    lastUpdatedAt: new Date(record.lastUpdatedAt).toISOString(),
    capturedAt: record.capturedAt,
    sequence: record.sequence,
    radarRangeMeters: record.radarRangeMeters,
    angleKind: record.angleKind,
    peerCount: Array.isArray(record.peers) ? record.peers.length : 0,
    peers: record.peers,
    observerLocation: record.observerLocation || null,
    observerAccuracyMeters: Number.isFinite(record.observerAccuracyMeters)
      ? record.observerAccuracyMeters
      : null,
    previousStatus: record.previousStatus || status,
  };
};

export const listRadarGateways = (now = Date.now()) => {
  const rows = [];
  for (const record of gateways.values()) {
    const age = now - record.lastUpdatedAt;
    if (age > RADAR_PRUNE_MS) {
      gateways.delete(record.gatewayUserId);
      continue;
    }
    const pub = toPublicRecord(record, now);
    rows.push({
      gatewayUserId: pub.gatewayUserId,
      displayName: pub.displayName,
      emergencyId: pub.emergencyId,
      status: pub.status,
      lastUpdatedAt: pub.lastUpdatedAt,
      sequence: pub.sequence,
      peerCount: pub.peerCount,
      angleKind: pub.angleKind,
      observerLocation: pub.observerLocation,
    });
  }
  const rank = { LIVE: 0, STALE: 1, OFFLINE: 2 };
  rows.sort((a, b) => {
    const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (r !== 0) return r;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''));
  });
  return rows;
};

export const getRadarGateway = (gatewayUserId, now = Date.now()) => {
  const record = gateways.get(String(gatewayUserId));
  if (!record) return null;
  if (now - record.lastUpdatedAt > RADAR_PRUNE_MS) {
    gateways.delete(String(gatewayUserId));
    return null;
  }
  return toPublicRecord(record, now);
};

/**
 * @returns {{ ok: boolean, duplicate?: boolean, reason?: string, record?: object, statusChanged?: boolean }}
 */
export const putRadarSnapshot = (
  {
    gatewayUserId,
    displayName,
    emergencyId,
    sequence,
    capturedAt,
    radarRangeMeters,
    angleKind,
    peers,
    observerLocation,
    observerAccuracyMeters,
  },
  now = Date.now()
) => {
  const id = String(gatewayUserId);
  const existing = gateways.get(id);

  if (existing && Number(sequence) < Number(existing.sequence)) {
    const status = computeRadarStatus(existing.lastUpdatedAt, now);
    if (status === 'LIVE') {
      return { ok: false, reason: 'stale_sequence', record: toPublicRecord(existing, now) };
    }
  }

  if (existing && Number(sequence) === Number(existing.sequence)) {
    existing.lastUpdatedAt = now;
    return {
      ok: true,
      duplicate: true,
      record: toPublicRecord(existing, now),
    };
  }

  const previousStatus = existing
    ? computeRadarStatus(existing.lastUpdatedAt, now)
    : null;

  const record = {
    gatewayUserId: id,
    displayName: displayName || 'Gateway',
    emergencyId: emergencyId || null,
    sequence: Number(sequence),
    capturedAt,
    radarRangeMeters: Number(radarRangeMeters) || 20,
    angleKind: angleKind || 'VISUAL_SECTOR',
    peers: Array.isArray(peers) ? peers : [],
    observerLocation: observerLocation || null,
    observerAccuracyMeters: Number.isFinite(Number(observerAccuracyMeters))
      ? Number(observerAccuracyMeters)
      : null,
    lastUpdatedAt: now,
    previousStatus: previousStatus || 'LIVE',
  };
  gateways.set(id, record);
  const pub = toPublicRecord(record, now);
  return {
    ok: true,
    duplicate: false,
    record: pub,
    statusChanged: previousStatus !== pub.status,
  };
};

export const collectStatusTransitions = (now = Date.now()) => {
  const changed = [];
  for (const record of gateways.values()) {
    const next = computeRadarStatus(record.lastUpdatedAt, now);
    const prev = record.previousStatus || next;
    if (now - record.lastUpdatedAt > RADAR_PRUNE_MS) {
      gateways.delete(record.gatewayUserId);
      if (prev !== 'OFFLINE') {
        changed.push({
          ...toPublicRecord({ ...record, previousStatus: prev }, now),
          status: 'OFFLINE',
        });
      }
      continue;
    }
    if (prev !== next) {
      record.previousStatus = next;
      changed.push(toPublicRecord(record, now));
    }
  }
  return changed;
};
