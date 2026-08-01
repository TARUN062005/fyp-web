/**
 * Confirms GET /admin/analytics returns server aggregates suitable for
 * the three analytics charts (not client-derived from raw report dumps).
 *
 * Usage: npm run verify:analytics
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import EmergencyCluster from '../models/EmergencyCluster.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'analytics-verify@dtnemergency.local';
const PREFIX = `analytics-${Date.now()}`;

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('AnalyticsVerify1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const marker = `${PREFIX}-user`;
  await User.deleteMany({
    $or: [{ googleAccountId: marker }, { emergencyId: 'EDTN-ANLYT' }],
  });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-ANLYT',
    displayName: 'Analytics Verify',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const todayKey = today.toISOString().slice(0, 10);

  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${PREFIX}`) });
  await EmergencyCluster.deleteMany({ clusterId: new RegExp(`^${PREFIX}`) });

  await EmergencyReport.insertMany([
    {
      messageId: `${PREFIX}-r1`,
      originalSenderId: user._id,
      uploaderId: user._id,
      emergencyType: 'flood',
      severity: 'HIGH',
      location: { type: 'Point', coordinates: [77.6, 12.9] },
      timestamp: today,
    },
    {
      messageId: `${PREFIX}-r2`,
      originalSenderId: user._id,
      uploaderId: user._id,
      emergencyType: 'flood',
      severity: 'LOW',
      location: { type: 'Point', coordinates: [77.61, 12.91] },
      timestamp: today,
    },
  ]);

  const clusterId = `CLUSTER-AN${String(Date.now()).slice(-6)}`;
  await EmergencyCluster.create({
    clusterId,
    emergencyType: 'flood',
    location: { type: 'Point', coordinates: [77.6, 12.9] },
    severity: 'HIGH',
    reportCount: 2,
    confidenceScore: 0.5,
    firstReportAt: today,
    lastReportAt: today,
    status: 'unverified',
  });

  const res = await request(app)
    .get('/admin/analytics')
    .query({ days: 7 })
    .set(auth);

  assert(res.status === 200, `analytics => ${res.status}`);
  const body = res.body.data;
  assert(Array.isArray(body.reportVolumeOverTime), 'missing reportVolumeOverTime');
  assert(Array.isArray(body.severityDistribution), 'missing severityDistribution');
  assert(Array.isArray(body.clusterGrowthOverTime), 'missing clusterGrowthOverTime');
  assert(body.reportVolumeOverTime.length === 7, 'volume series length');
  assert(body.clusterGrowthOverTime.length === 7, 'cluster series length');

  const volumeToday = body.reportVolumeOverTime.find((d) => d.date === todayKey);
  assert(volumeToday?.count >= 2, `volume today=${volumeToday?.count}`);

  const high = body.severityDistribution.find((s) => s.severity === 'HIGH');
  const low = body.severityDistribution.find((s) => s.severity === 'LOW');
  assert(high?.count >= 1, 'HIGH severity missing');
  assert(low?.count >= 1, 'LOW severity missing');

  const growthToday = body.clusterGrowthOverTime.find((d) => d.date === todayKey);
  assert(
    typeof growthToday?.created === 'number' &&
      typeof growthToday?.cumulative === 'number',
    'cluster growth point shape'
  );

  // dashboard-summary is NOT a substitute (scalars only)
  const summary = await request(app)
    .get('/admin/dashboard-summary')
    .set(auth);
  assert(summary.status === 200, 'dashboard-summary failed');
  assert(
    !summary.body.data.reportVolumeOverTime,
    'dashboard-summary unexpectedly has time-series'
  );

  console.log('[verify] GET /admin/analytics returns all three chart series ✓');
  console.log(
    '[verify] PASS — analytics requires new aggregate endpoint (not B9 lists/summary)'
  );

  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${PREFIX}`) });
  await EmergencyCluster.deleteMany({ clusterId });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
