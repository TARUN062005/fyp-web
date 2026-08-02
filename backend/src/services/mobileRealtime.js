import { getMobileNamespace } from '../config/socket.js';

/**
 * Broadcast to all sockets on the mobile namespace (`/mobile`).
 * No-ops when Socket.IO has not been initialised.
 */
export const emitToMobile = (event, payload) => {
  const nsp = getMobileNamespace();
  if (!nsp) return false;
  nsp.emit(event, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
  return true;
};
