export const RADAR_STALE_MS = 20_000;
export const RADAR_OFFLINE_MS = 60_000;

export const RadarSocketEvents = {
  GATEWAY_UPDATED: 'radar:gateway:updated',
  GATEWAY_STATUS: 'radar:gateway:status',
  SUBSCRIBE: 'radar:subscribe',
  UNSUBSCRIBE: 'radar:unsubscribe',
};

export const gatewayStatusFromAge = (
  lastUpdatedAt,
  now = Date.now(),
  staleMs = RADAR_STALE_MS,
  offlineMs = RADAR_OFFLINE_MS
) => {
  if (!lastUpdatedAt) return 'OFFLINE';
  const ts = new Date(lastUpdatedAt).getTime();
  if (!Number.isFinite(ts)) return 'OFFLINE';
  const age = now - ts;
  if (age > offlineMs) return 'OFFLINE';
  if (age > staleMs) return 'STALE';
  return 'LIVE';
};

export const shouldApplyRadarUpdate = (selectedGatewayId, payload) => {
  if (!selectedGatewayId || !payload?.gatewayUserId) return false;
  return String(payload.gatewayUserId) === String(selectedGatewayId);
};

export const mergeGatewayList = (gateways, statusPayload) => {
  if (!statusPayload?.gatewayUserId) return gateways || [];
  const list = Array.isArray(gateways) ? [...gateways] : [];
  const idx = list.findIndex(
    (g) => g.gatewayUserId === statusPayload.gatewayUserId
  );
  const next = {
    gatewayUserId: statusPayload.gatewayUserId,
    displayName: statusPayload.displayName || list[idx]?.displayName || 'Gateway',
    emergencyId: statusPayload.emergencyId || list[idx]?.emergencyId || null,
    status: statusPayload.status || list[idx]?.status || 'STALE',
    lastUpdatedAt: statusPayload.lastUpdatedAt ?? list[idx]?.lastUpdatedAt ?? null,
    sequence: statusPayload.sequence ?? list[idx]?.sequence ?? 0,
    peerCount: statusPayload.peerCount ?? list[idx]?.peerCount ?? 0,
    angleKind: statusPayload.angleKind || list[idx]?.angleKind || 'VISUAL_SECTOR',
    observerLocation:
      statusPayload.observerLocation ?? list[idx]?.observerLocation ?? null,
  };
  if (idx === -1) {
    list.push(next);
  } else {
    list[idx] = { ...list[idx], ...next };
  }
  return list;
};

export const formatAge = (lastUpdatedAt, now = Date.now()) => {
  if (!lastUpdatedAt) return 'never';
  const ts = new Date(lastUpdatedAt).getTime();
  if (!Number.isFinite(ts)) return 'never';
  const sec = Math.max(0, Math.round((now - ts) / 1000));
  if (sec < 60) return `${sec} second${sec === 1 ? '' : 's'} ago`;
  const min = Math.round(sec / 60);
  return `${min} minute${min === 1 ? '' : 's'} ago`;
};
