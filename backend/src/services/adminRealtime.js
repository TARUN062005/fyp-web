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
