import { touchDevicePresence } from '../services/devicePresenceService.js';

/**
 * After mobile auth, refresh Device.lastSeenAt when the client sends
 * `X-Device-Id` (optional `X-App-Version`). Failures are non-blocking.
 */
export const touchPresence = (req, _res, next) => {
  const deviceId = req.get('x-device-id')?.trim();
  if (!req.user?.userId || !deviceId) {
    return next();
  }

  const appVersion = req.get('x-app-version')?.trim() || undefined;

  touchDevicePresence({
    userId: req.user.userId,
    deviceId,
    ...(appVersion ? { appVersion } : {}),
  }).catch(() => {
    /* presence is best-effort — never fail the request */
  });

  return next();
};
