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

const rankState = (state) => {
  if (state === 'CONNECTED') return 3;
  if (state === 'DISCOVERED') return 2;
  return 1;
};

const preferPeer = (current, incoming) => {
  if (!current) return incoming;
  const gpsIn = incoming?.locationSource === 'GPS' && incoming?.location;
  const gpsCur = current?.locationSource === 'GPS' && current?.location;
  if (gpsIn && !gpsCur) return { ...current, ...incoming, location: incoming.location, locationSource: 'GPS' };
  if (gpsCur && !gpsIn) {
    return {
      ...incoming,
      ...current,
      location: current.location,
      locationSource: 'GPS',
      connectionState:
        rankState(incoming.connectionState) > rankState(current.connectionState)
          ? incoming.connectionState
          : current.connectionState,
    };
  }
  if (rankState(incoming.connectionState) > rankState(current.connectionState)) {
    return { ...current, ...incoming };
  }
  return current;
};

/**
 * Union the selected gateway snapshot with radars published by other
 * internet-connected nodes in the same mesh neighbourhood.
 */
export const mergeRadarSnapshots = (selected, others = []) => {
  if (!selected) return selected;
  const selectedId = String(selected.gatewayUserId || '');
  const peers = new Map();

  const ingestPeers = (list) => {
    (list || []).forEach((peer) => {
      if (!peer?.peerId) return;
      if (String(peer.peerId) === selectedId) return;
      peers.set(peer.peerId, preferPeer(peers.get(peer.peerId), peer));
    });
  };

  ingestPeers(selected.peers);

  const frontier = new Set(
    (selected.peers || []).map((p) => String(p.peerId)).filter(Boolean)
  );
  frontier.add(selectedId);
  const consumed = new Set([selectedId]);
  const pool = (others || []).filter(
    (snap) => snap?.gatewayUserId && String(snap.gatewayUserId) !== selectedId
  );

  let progressed = true;
  while (progressed) {
    progressed = false;
    pool.forEach((snap) => {
      const id = String(snap.gatewayUserId);
      if (consumed.has(id)) return;
      const otherIds = new Set(
        (snap.peers || []).map((p) => String(p.peerId)).filter(Boolean)
      );
      const linked =
        frontier.has(id) ||
        otherIds.has(selectedId) ||
        [...otherIds].some((peerId) => frontier.has(peerId));
      if (!linked) return;
      consumed.add(id);
      progressed = true;
      ingestPeers(snap.peers);
      if (!peers.has(id)) {
        peers.set(id, {
          peerId: id,
          displayName: snap.displayName || 'Gateway',
          emergencyId: snap.emergencyId || null,
          connectionState: 'CONNECTED',
          distanceMeters: 0,
          beyondRadarRange: false,
          angleDegrees: 0,
          lastSeen: snap.lastUpdatedAt || snap.capturedAt || null,
          location: snap.observerLocation || null,
          locationSource: snap.observerLocation ? 'GPS' : null,
        });
      }
      frontier.add(id);
      otherIds.forEach((peerId) => frontier.add(peerId));
    });
  }

  return { ...selected, peers: Array.from(peers.values()) };
};
