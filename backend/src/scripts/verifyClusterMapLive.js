/**
 * Verifying a cluster via POST /admin/verify-cluster updates the map's
 * clusters cache status (via cluster:verified socket) without refetching
 * GET /clusters.
 *
 * Usage: npm run verify:cluster-map-live
 */
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { initSocket } from '../config/socket.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';
import { issueTokenPair } from '../services/tokenService.js';
import { AdminSocketEvents } from '../services/adminRealtime.js';

const ADMIN_EMAIL = 'cluster-map-live@dtnemergency.local';
const TYPE = 'other';

const applyClustersSocketEvent = (clusters, event, payload) => {
  if (clusters == null) return clusters;
  const cluster = payload?.cluster;
  if (!cluster) return clusters;
  if (
    event !== AdminSocketEvents.CLUSTER_VERIFIED &&
    event !== AdminSocketEvents.CLUSTER_CREATED &&
    event !== AdminSocketEvents.CLUSTER_UPDATED
  ) {
    return clusters;
  }
  const list = [...clusters];
  const idx = list.findIndex(
    (c) => c.id === cluster.id || c.clusterId === cluster.clusterId
  );
  if (idx === -1) list.push(cluster);
  else list[idx] = { ...list[idx], ...cluster };
  return list;
};

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const waitFor = (socket, event, predicate, timeoutMs = 10000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for ${event}`)),
      timeoutMs
    );
    const handler = (payload) => {
      if (predicate && !predicate(payload)) return;
      clearTimeout(t);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('ClusterMapLive1!', 10),
    role: 'admin',
  });
  const { accessToken: adminAccess } = await issueAdminTokenPair(
    admin._id,
    admin.role
  );

  const marker = `cl-map-${Date.now()}`;
  await User.deleteMany({ googleAccountId: marker });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-CMLIV',
    displayName: 'Cluster Map Live',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });
  const { accessToken: mobileAccess } = await issueTokenPair(user._id);

  const server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  // Seed map cache (single GET — page load)
  const listRes = await request(app)
    .get('/clusters')
    .set('Authorization', `Bearer ${adminAccess}`);
  assert(listRes.status === 200, `GET /clusters => ${listRes.status}`);
  let mapCache = listRes.body.data.clusters ?? [];
  let clusterFetches = 1;

  const socket = ioc(`${base}/admin`, {
    auth: { token: adminAccess },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket connect timeout')), 5000);
  });

  const messageId = `cl-map-live-${Date.now()}`;
  const createdP = waitFor(socket, AdminSocketEvents.CLUSTER_CREATED);
  const upload = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send({
      messageId,
      originalSenderId: String(user._id),
      uploaderId: String(user._id),
      emergencyType: TYPE,
      severity: 'MEDIUM',
      location: { type: 'Point', coordinates: [80.27, 13.08] },
      timestamp: new Date().toISOString(),
    });
  assert(upload.status === 201, `upload => ${upload.status}`);
  const created = await createdP;
  mapCache = applyClustersSocketEvent(
    mapCache,
    AdminSocketEvents.CLUSTER_CREATED,
    created
  );

  const clusterId = created.cluster.clusterId;
  assert(
    mapCache.find((c) => c.clusterId === clusterId)?.status === 'unverified',
    'new cluster should be unverified on map cache'
  );
  console.log(`[verify] map cache has ${clusterId} status=unverified ✓`);

  const verifiedP = waitFor(
    socket,
    AdminSocketEvents.CLUSTER_VERIFIED,
    (p) => p?.cluster?.clusterId === clusterId
  );

  const verifyRes = await request(app)
    .post('/admin/verify-cluster')
    .set('Authorization', `Bearer ${adminAccess}`)
    .send({ clusterId });
  assert(verifyRes.status === 200, `verify => ${verifyRes.status}`);

  const verified = await verifiedP;
  mapCache = applyClustersSocketEvent(
    mapCache,
    AdminSocketEvents.CLUSTER_VERIFIED,
    verified
  );

  const onMap = mapCache.find((c) => c.clusterId === clusterId);
  assert(onMap?.status === 'verified', `map status=${onMap?.status}`);
  assert(clusterFetches === 1, 'GET /clusters was refetched — live path broken');

  // Reports for cluster (row expansion data)
  const reports = await request(app)
    .get('/admin/reports')
    .query({ clusterId, limit: 50 })
    .set('Authorization', `Bearer ${adminAccess}`);
  assert(reports.status === 200, `reports => ${reports.status}`);
  assert(
    reports.body.data.reports.some((r) => r.messageId === messageId),
    'cluster reports missing uploaded message'
  );
  console.log('[verify] GET /admin/reports?clusterId includes report ✓');

  console.log(
    `[verify] status unverified→verified on map cache without refetch ✓`
  );
  console.log(
    '[verify] PASS — verifying a cluster updates F4 map status live'
  );

  socket.close();
  await new Promise((resolve) => server.close(resolve));
  await EmergencyReport.deleteMany({ messageId });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
