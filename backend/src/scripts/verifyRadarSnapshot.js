/**
 * Radar snapshot HTTP + /admin Socket.IO subscribe.
 *
 * Usage: node src/scripts/verifyRadarSnapshot.js
 */
import http from 'http';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { io as ioc } from 'socket.io-client';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { initSocket } from '../config/socket.js';
import env from '../config/env.js';
import mongoose from 'mongoose';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';
import { issueTokenPair } from '../services/tokenService.js';
import { resetRadarStore } from '../services/radarGatewayStore.js';
import { AdminSocketEvents } from '../services/adminRealtime.js';

const ADMIN_EMAIL = 'radar-admin@dtnemergency.local';

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

const snapshotBody = (sequence = 1) => ({
  capturedAt: new Date().toISOString(),
  sequence,
  radarRangeMeters: 20,
  angleKind: 'VISUAL_SECTOR',
  peers: [
    {
      peerId: 'peer-a',
      emergencyId: 'EDTN-AAAAA',
      displayName: 'Person A',
      connectionState: 'CONNECTED',
      distanceMeters: 18.4,
      beyondRadarRange: false,
      angleDegrees: 12.5,
    },
  ],
});

const run = async () => {
  await connectDB();
  resetRadarStore();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('RadarAdminPass1!', 10),
    role: 'admin',
  });
  const { accessToken: adminAccess } = await issueAdminTokenPair(
    admin._id,
    admin.role
  );

  const marker = `radar-gw-${Date.now()}`;
  await User.deleteMany({ googleAccountId: marker });
  await User.deleteMany({ emergencyId: 'EDTN-RAD01' });
  const gateway = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-RAD01',
    displayName: 'Gateway C',
    publicKey: 'pk-radar',
    publicKeyFingerprint: 'fp-radar',
    isVerified: true,
  });
  const { accessToken: mobileAccess } = await issueTokenPair(gateway._id);

  const server = http.createServer(app);
  initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  const unauth = await request(app).post('/radar/snapshot').send(snapshotBody());
  assert(unauth.status === 401, `expected 401 without JWT, got ${unauth.status}`);
  console.log('[verify] unauthenticated snapshot => 401 ✓');

  const badDistance = await request(app)
    .post('/radar/snapshot')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send({
      ...snapshotBody(),
      peers: [
        {
          peerId: 'p',
          displayName: 'X',
          connectionState: 'CONNECTED',
          distanceMeters: 9999,
          angleDegrees: 0,
        },
      ],
    });
  assert(badDistance.status === 400, `bad distance expected 400, got ${badDistance.status}`);
  console.log('[verify] invalid distance => 400 ✓');

  const spoof = await request(app)
    .post('/radar/snapshot')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send({ ...snapshotBody(), observerId: '507f1f77bcf86cd799439099' });
  assert(spoof.status === 403, `spoof observer expected 403, got ${spoof.status}`);
  console.log('[verify] spoofed observerId => 403 ✓');

  const adminAsMobile = await request(app)
    .post('/radar/snapshot')
    .set('Authorization', `Bearer ${adminAccess}`)
    .send(snapshotBody());
  assert(
    adminAsMobile.status === 401,
    `admin JWT on mobile radar expected 401, got ${adminAsMobile.status}`
  );
  console.log('[verify] admin JWT cannot publish radar => 401 ✓');

  const ok = await request(app)
    .post('/radar/snapshot')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send(snapshotBody(1));
  assert(ok.status === 200, `snapshot expected 200, got ${ok.status}`);
  assert(ok.body.data.accepted === true, 'accepted should be true');
  console.log('[verify] authorized snapshot => 200 ✓');

  const guestList = await request(app).get('/admin/radar/gateways');
  assert(guestList.status === 401, 'admin list must require admin JWT');
  console.log('[verify] GET /admin/radar/gateways without JWT => 401 ✓');

  const list = await request(app)
    .get('/admin/radar/gateways')
    .set('Authorization', `Bearer ${adminAccess}`);
  assert(list.status === 200, `list expected 200, got ${list.status}`);
  assert(list.body.data.gateways.length === 1, 'expected one gateway');
  assert(
    list.body.data.gateways[0].gatewayUserId === String(gateway._id),
    'gateway id mismatch'
  );
  console.log('[verify] admin gateway list => 1 LIVE gateway ✓');

  const socket = ioc(`http://127.0.0.1:${port}/admin`, {
    auth: { token: adminAccess },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('admin socket connect timeout')), 5000);
  });

  const pending = waitForEvent(socket, AdminSocketEvents.RADAR_GATEWAY_UPDATED);
  socket.emit('radar:subscribe', { gatewayUserId: String(gateway._id) });
  const snap = await pending;
  assert(snap.gatewayUserId === String(gateway._id), 'subscribe snapshot gateway mismatch');
  assert(snap.peers[0].displayName === 'Person A', 'peer name missing');
  console.log('[verify] radar:subscribe delivered current snapshot ✓');

  const nextPending = waitForEvent(socket, AdminSocketEvents.RADAR_GATEWAY_UPDATED);
  await request(app)
    .post('/radar/snapshot')
    .set('Authorization', `Bearer ${mobileAccess}`)
    .send({
      ...snapshotBody(2),
      peers: [
        {
          peerId: 'peer-b',
          displayName: 'Person B',
          connectionState: 'DISCOVERED',
          distanceMeters: 7,
          angleDegrees: -20,
        },
      ],
    });
  const live = await nextPending;
  assert(live.peers[0].displayName === 'Person B', 'live update did not replace peers');
  console.log('[verify] radar:gateway:updated after second snapshot ✓');

  socket.close();
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  console.log('[verify] PASS — radar snapshot + subscribe');
};

run().catch(async (err) => {
  console.error(`[verify] FAIL: ${err.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
