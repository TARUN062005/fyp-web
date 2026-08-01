/**
 * Confirms device online/offline reflects Device.lastSeenAt freshness
 * against DEVICE_ONLINE_WINDOW_MS (configurable).
 *
 * Usage: npm run verify:device-online
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';
import { DEVICE_ONLINE_MS } from '../services/devicePresenceService.js';

const ADMIN_EMAIL = 'device-online@dtnemergency.local';

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('DeviceOnline1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const marker = `device-online-${Date.now()}`;
  await User.deleteMany({
    $or: [{ googleAccountId: marker }, { emergencyId: 'EDTN-DEVON' }],
  });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-DEVON',
    displayName: 'Device Online Verify',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });

  const freshId = `fresh-${Date.now()}`;
  const staleId = `stale-${Date.now()}`;
  const now = Date.now();

  await Device.deleteMany({ userId: user._id });
  await Device.create([
    {
      userId: user._id,
      deviceId: freshId,
      appVersion: '1.2.0',
      status: 'active',
      lastSeenAt: new Date(now - 60_000), // 1 min ago → online
    },
    {
      userId: user._id,
      deviceId: staleId,
      appVersion: '1.1.0',
      status: 'active',
      lastSeenAt: new Date(now - DEVICE_ONLINE_MS - 60_000), // outside window → offline
    },
  ]);

  const listRes = await request(app)
    .get('/admin/devices')
    .query({ userId: String(user._id), limit: 50 })
    .set(auth);
  assert(listRes.status === 200, `list => ${listRes.status}`);
  assert(
    typeof listRes.body.data.onlineWindowMs === 'number',
    'missing onlineWindowMs'
  );
  assert(
    listRes.body.data.onlineWindowMs === DEVICE_ONLINE_MS,
    `window mismatch: api=${listRes.body.data.onlineWindowMs} env=${DEVICE_ONLINE_MS}`
  );

  const devices = listRes.body.data.devices || [];
  const fresh = devices.find((d) => d.deviceId === freshId);
  const stale = devices.find((d) => d.deviceId === staleId);
  assert(fresh?.online === true, `fresh device online=${fresh?.online}`);
  assert(stale?.online === false, `stale device online=${stale?.online}`);
  console.log(
    `[verify] freshness window=${DEVICE_ONLINE_MS}ms (${DEVICE_ONLINE_MS / 60000} min) ✓`
  );
  console.log('[verify] fresh lastSeenAt → online; stale → offline ✓');

  const onlineOnly = await request(app)
    .get('/admin/devices')
    .query({ userId: String(user._id), online: true })
    .set(auth);
  assert(onlineOnly.status === 200, `online filter => ${onlineOnly.status}`);
  const onlineIds = (onlineOnly.body.data.devices || []).map((d) => d.deviceId);
  assert(onlineIds.includes(freshId), 'online filter missing fresh device');
  assert(!onlineIds.includes(staleId), 'online filter leaked stale device');

  const offlineOnly = await request(app)
    .get('/admin/devices')
    .query({ userId: String(user._id), online: false })
    .set(auth);
  const offlineIds = (offlineOnly.body.data.devices || []).map((d) => d.deviceId);
  assert(offlineIds.includes(staleId), 'offline filter missing stale device');
  assert(!offlineIds.includes(freshId), 'offline filter leaked fresh device');
  console.log('[verify] online/offline filters match lastSeenAt cutoff ✓');

  console.log(
    '[verify] PASS — status reflects lastSeenAt freshness (configurable window)'
  );

  await Device.deleteMany({ userId: user._id });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
