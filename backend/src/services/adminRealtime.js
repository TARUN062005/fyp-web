import { getAdminNamespace } from '../config/socket.js';

/** Event names for the admin Socket.IO namespace (`/admin`). */
export const AdminSocketEvents = {
  REPORT_CREATED: 'report:created',
  REPORT_UPDATED: 'report:updated',
  REPORT_CONSENSUS: 'report:consensus',
  CLUSTER_CREATED: 'cluster:created',
  CLUSTER_UPDATED: 'cluster:updated',
  CLUSTER_VERIFIED: 'cluster:verified',
  CLUSTER_MERGED: 'cluster:merged',
  DEVICE_STATUS: 'device:status',
  USER_BLOCKED: 'user:blocked',
  USER_UNBLOCKED: 'user:unblocked',
  USER_CREATED: 'user:created',
  RADAR_GATEWAY_UPDATED: 'radar:gateway:updated',
  RADAR_GATEWAY_STATUS: 'radar:gateway:status',
};

export const radarRoomName = (gatewayUserId) => `radar:${gatewayUserId}`;

/** Snapshot payload — only sockets that subscribed to this gateway. */
export const emitToRadarRoom = (gatewayUserId, event, payload) => {
  const nsp = getAdminNamespace();
  if (!nsp) return false;
  nsp.to(radarRoomName(gatewayUserId)).emit(event, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
  return true;
};

/**
 * Broadcast to all sockets on the admin namespace.
 * No-ops safely when Socket.IO has not been initialised (e.g. unit scripts).
 */
export const emitToAdmin = (event, payload) => {
  const nsp = getAdminNamespace();
  if (!nsp) return false;
  nsp.emit(event, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
  return true;
};
