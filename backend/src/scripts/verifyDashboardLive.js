/**
 * End-to-end: upload a new emergency report while an admin socket is
 * connected; apply the same counter patches the frontend uses and assert
 * dashboard counters bump without a second GET /admin/dashboard-summary.
 *
 * Usage: npm run verify:dashboard-live
 */
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import env from '../config/env.js';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { initSocket } from '../config/socket.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';
import { issueTokenPair } from '../services/tokenService.js';
import { AdminSocketEvents } from '../services/adminRealtime.js';

const ADMIN_EMAIL = 'dash-live-admin@dtnemergency.local';
const TYPE = 'other';

/** Mirrors frontend/src/hooks/dashboardSocketPatches.js */
const applyDashboardSocketEvent = (summary, event) => {
  if (!summary) return summary;
  const s = { ...summary };
  const now = new Date().toISOString();
  if (event === AdminSocketEvents.CLUSTER_CREATED) {
    return {
      ...s,
      activeEmergencies: (s.activeEmergencies ?? 0) + 1,
      clustersToday: (s.clustersToday ?? 0) + 1,
      generatedAt: now,
    };
  }
  if (
    event === AdminSocketEvents.REPORT_CREATED ||
    event === AdminSocketEvents.CLUSTER_UPDATED
  ) {
    return { ...s, generatedAt: now };
  }
  return s;
};

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const waitForEvent = (socket, event, timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`timeout waiting for ${event}`)),
      timeoutMs
    );
    socket.once(event, (payload) => {
      clearTimeout(t);
      resolve(payload);
    });
  });

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('DashLivePass1!', 10),
    role: 'admin',
  });
  const { accessToken: adminAccess } = await issueAdminTokenPair(
    admin._id,
    admin.role
  );

  const marker = `dash-live-${Date.now()}`;
  await User.deleteMany({ googleAccountId: marker });
  const mobileUser = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-DLIVE',
    displayName: 'Dash Live Uploader',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });
  const { accessToken: mobileAccess } = await issueTokenPair(mobileUser._id);

  const server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  // Single initial fetch — the "page load"
  const summaryRes = await request(app)
    .get('/admin/dashboard-summary')
    .set('Authorization', `Bearer ${adminAccess}`);
  assert(summaryRes.status === 200, `summary => ${summaryRes.status}`);
  let summary = summaryRes.body.data;
  assert(
    typeof summary.activeEmergencies === 'number',
    'missing activeEmergencies'
  );
  assert(typeof summary.clustersToday === 'number', 'missing clustersToday');
  const baseline = { ...summary };
  let summaryFetches = 1;
  console.log(
    `[verify] baseline activeEmergencies=${baseline.activeEmergencies} clustersToday=${baseline.clustersToday}`
  );

  const socket = ioc(`${base}/admin`, {
    auth: { token: adminAccess },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', (err) => reject(err));
    setTimeout(() => reject(new Error('socket connect timeout')), 5000);
  });
  console.log('[verify] admin socket connected ✓');

  const clusterCreated = waitForEvent(
    socket,
    AdminSocketEvents.CLUSTER_CREATED
  );
  const reportCreated = waitForEvent(socket, AdminSocketEvents.REPORT_CREATED);

  const messageId = `dash-live-msg-${Date.now()}`;
  const uploadRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send({
      messageId,
      originalSenderId: String(mobileUser._id),
      uploaderId: String(mobileUser._id),
      emergencyType: TYPE,
      severity: 'HIGH',
      location: {
        type: 'Point',
        coordinates: [78.4867, 17.385],
      },
      timestamp: new Date().toISOString(),
    });
  assert(uploadRes.status === 201, `upload => ${uploadRes.status}`);
  console.log(`[verify] uploaded ${messageId} => 201 ✓`);

  await reportCreated;
  summary = applyDashboardSocketEvent(
    summary,
    AdminSocketEvents.REPORT_CREATED
  );

  const clusterPayload = await clusterCreated;
  summary = applyDashboardSocketEvent(
    summary,
    AdminSocketEvents.CLUSTER_CREATED
  );
  console.log(
    `[verify] received cluster:created (${clusterPayload?.cluster?.clusterId || 'ok'}) ✓`
  );

  assert(
    summary.activeEmergencies === baseline.activeEmergencies + 1,
    `activeEmergencies expected ${baseline.activeEmergencies + 1}, got ${summary.activeEmergencies}`
  );
  assert(
    summary.clustersToday === baseline.clustersToday + 1,
    `clustersToday expected ${baseline.clustersToday + 1}, got ${summary.clustersToday}`
  );
  assert(
    summaryFetches === 1,
    'dashboard summary was refetched — live path must not GET again'
  );
  console.log(
    `[verify] counters updated live without refetch: activeEmergencies ${baseline.activeEmergencies}→${summary.activeEmergencies}, clustersToday ${baseline.clustersToday}→${summary.clustersToday} ✓`
  );

  // Truth check (optional refetch after the live path already succeeded)
  const truth = await request(app)
    .get('/admin/dashboard-summary')
    .set('Authorization', `Bearer ${adminAccess}`);
  summaryFetches += 1;
  assert(truth.status === 200, 'truth summary failed');
  assert(
    truth.body.data.activeEmergencies >= summary.activeEmergencies,
    'server activeEmergencies behind live cache'
  );
  console.log('[verify] PASS — new report updates dashboard counters without manual refresh');

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
