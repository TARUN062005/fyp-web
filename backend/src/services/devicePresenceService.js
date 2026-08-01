import Device from '../models/Device.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';

export const DEVICE_ONLINE_MS =
  Number(process.env.DEVICE_ONLINE_WINDOW_MS) || 15 * 60 * 1000;

export const isDeviceOnline = (device, now = Date.now()) => {
  if (!device || device.status !== 'active' || !device.lastSeenAt) {
    return false;
  }
  return new Date(device.lastSeenAt).getTime() >= now - DEVICE_ONLINE_MS;
};

const toDevicePayload = (device, online) => ({
  id: String(device._id),
  userId: String(device.userId),
  deviceId: device.deviceId,
  status: device.status,
  lastSeenAt: device.lastSeenAt,
  online,
  appVersion: device.appVersion ?? null,
});

/**
 * Update Device.lastSeenAt and emit device:status when online/offline flips
 * (or when status field changes). Used by presence touch-points and model hooks.
 */
export const touchDevicePresence = async ({
  userId,
  deviceId,
  appVersion,
  status,
}) => {
  if (!userId || !deviceId) {
    throw new Error('userId and deviceId are required');
  }

  const existing = await Device.findOne({ userId, deviceId });
  const wasOnline = isDeviceOnline(existing);

  const device = await Device.findOneAndUpdate(
    { userId, deviceId },
    {
      $set: {
        lastSeenAt: new Date(),
        ...(appVersion !== undefined ? { appVersion } : {}),
        ...(status !== undefined ? { status } : {}),
        userId,
        deviceId,
      },
      $setOnInsert: {
        status: status || 'active',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const nowOnline = isDeviceOnline(device);
  if (!existing || wasOnline !== nowOnline || (status && existing.status !== device.status)) {
    emitToAdmin(AdminSocketEvents.DEVICE_STATUS, {
      device: toDevicePayload(device, nowOnline),
      previousOnline: existing ? wasOnline : false,
    });
  }

  return device;
};

/**
 * Call after any direct Device save that may change presence.
 */
export const emitDeviceStatusIfChanged = (device, previousOnline) => {
  const online = isDeviceOnline(device);
  if (previousOnline === online) return;
  emitToAdmin(AdminSocketEvents.DEVICE_STATUS, {
    device: toDevicePayload(device, online),
    previousOnline,
  });
};
