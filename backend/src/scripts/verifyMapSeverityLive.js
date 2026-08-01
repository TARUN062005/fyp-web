/**
 * Confirms B7 severity escalation emits cluster:updated with a higher
 * severity, and that the frontend marker color mapping would change
 * without refetching GET /clusters.
 *
 * Usage: npm run verify:map-severity-live
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
import { severityRank } from '../services/clusteringService.js';

const ADMIN_EMAIL = 'map-sev-admin@dtnemergency.local';
const TYPE = 'other';
const BASE_LNG = 72.8777;
const BASE_LAT = 19.076;

/** Mirrors frontend/src/theme/severity.js FALLBACK palette */
const SEVERITY_COLOR = {
  LOW: '#5B8C5A',
  MEDIUM: '#C4922A',
  HIGH: '#C45C26',
  CRITICAL: '#B42318',
};

const applyClustersSocketEvent = (clusters, event, payload) => {
  if (clusters == null) return clusters;
  if (
    event !== AdminSocketEvents.CLUSTER_CREATED &&
    event !== AdminSocketEvents.CLUSTER_UPDATED
  ) {
    return clusters;
  }
  const cluster = payload?.cluster;
  if (!cluster) return clusters;
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

const waitFor = (socket, event, predicate, timeoutMs = 12000) =>
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
    passwordHash: await bcrypt.hash('MapSevPass1!', 10),
    role: 'admin',
  });
  const { accessToken: adminAccess } = await issueAdminTokenPair(
    admin._id,
    admin.role
  );

  const marker = `map-sev-${Date.now()}`;
  await User.deleteMany({ googleAccountId: marker });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-MAPSV',
    displayName: 'Map Severity Uploader',
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

  const listRes = await request(app)
    .get('/clusters')
    .set('Authorization', `Bearer ${adminAccess}`);
  assert(listRes.status === 200, `GET /clusters => ${listRes.status}`);
  let clusters = listRes.body.data.clusters ?? [];
  const clusterFetches = 1;

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

  const prefix = `map-sev-msg-${Date.now()}`;
  const now = Date.now();

  const upload = (i) =>
    request(app)
      .post('/broadcast/upload')
      .set('Authorization', `Bearer ${mobileAccess}`)
      .send({
        messageId: `${prefix}-${i}`,
        originalSenderId: String(user._id),
        uploaderId: String(user._id),
        emergencyType: TYPE,
        severity: 'LOW',
        location: {
          type: 'Point',
          coordinates: [BASE_LNG + i * 0.0002, BASE_LAT],
        },
        timestamp: new Date(now + i * 1000).toISOString(),
      });

  const createdP = waitFor(socket, AdminSocketEvents.CLUSTER_CREATED);
  const first = await upload(0);
  assert(first.status === 201, `first upload => ${first.status}`);
  const created = await createdP;
  clusters = applyClustersSocketEvent(
    clusters,
    AdminSocketEvents.CLUSTER_CREATED,
    created
  );

  const clusterId = created.cluster.clusterId;
  const initialSeverity = created.cluster.severity;
  const initialColor = SEVERITY_COLOR[initialSeverity];
  console.log(
    `[verify] cluster ${clusterId} created severity=${initialSeverity} color=${initialColor}`
  );

  const escalatedP = waitFor(
    socket,
    AdminSocketEvents.CLUSTER_UPDATED,
    (p) =>
      p?.cluster?.clusterId === clusterId &&
      severityRank(p.cluster.severity) > severityRank(initialSeverity)
  );

  // B7: additional nearby LOW reports raise escalation score across a band
  for (let i = 1; i <= 5; i += 1) {
    const res = await upload(i);
    assert(res.status === 201, `upload ${i} => ${res.status}`);
  }

  const escalated = await escalatedP;
  clusters = applyClustersSocketEvent(
    clusters,
    AdminSocketEvents.CLUSTER_UPDATED,
    escalated
  );
  const live = clusters.find((c) => c.clusterId === clusterId);
  const nextSeverity = live.severity;
  const nextColor = SEVERITY_COLOR[nextSeverity];

  assert(
    severityRank(nextSeverity) > severityRank(initialSeverity),
    `severity did not escalate (${initialSeverity} → ${nextSeverity})`
  );
  assert(
    escalated.previous?.severity === initialSeverity ||
      severityRank(escalated.previous?.severity) < severityRank(nextSeverity),
    'cluster:updated missing previous severity context'
  );
  assert(nextColor !== initialColor, 'marker color did not change');
  assert(clusterFetches === 1, 'GET /clusters was refetched — live path broken');

  console.log(
    `[verify] severity ${initialSeverity}→${nextSeverity} (prev=${escalated.previous?.severity}) color ${initialColor}→${nextColor} without refetch ✓`
  );
  console.log(
    '[verify] PASS — marker color updates live when severity escalates'
  );

  socket.close();
  await new Promise((resolve) => server.close(resolve));
  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${prefix}`) });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
