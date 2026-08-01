/**
 * Confirms each mutating admin route writes exactly one AuditLog entry.
 *
 * Usage: npm run verify:admin-audit
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyCluster from '../models/EmergencyCluster.js';
import EmergencyReport from '../models/EmergencyReport.js';
import AuditLog from '../models/AuditLog.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'admin-ops-audit@dtnemergency.local';
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const countLogs = (adminId, action, since) =>
  AuditLog.countDocuments({
    adminId,
    action,
    timestamp: { $gte: since },
  });

const run = async () => {
  await mongoose.connect(env.mongoUri);

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('AdminOpsAudit1!', 10),
    role: 'superadmin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };

  await User.deleteMany({ googleAccountId: 'admin-ops-audit-user' });
  const user = await User.create({
    googleAccountId: 'admin-ops-audit-user',
    emergencyId: 'EDTN-AOAU1',
    displayName: 'Audit Target',
    publicKey: 'pk-audit',
    publicKeyFingerprint: 'fp-audit',
    isVerified: true,
    isBlocked: false,
  });

  const mkCluster = async (clusterId, reportCount = 1) => {
    await EmergencyCluster.deleteMany({ clusterId });
    return EmergencyCluster.create({
      clusterId,
      emergencyType: 'flood',
      location: { type: 'Point', coordinates: [77.6, 12.97] },
      severity: 'MEDIUM',
      reportCount,
      confidenceScore: 0.4,
      firstReportAt: new Date(Date.now() - 60_000),
      lastReportAt: new Date(),
      status: 'unverified',
    });
  };

  const source = await mkCluster('CLUSTER-AUDITSRC');
  const target = await mkCluster('CLUSTER-AUDITTGT');

  await EmergencyReport.deleteMany({
    messageId: { $in: ['audit-merge-a', 'audit-merge-b'] },
  });
  await EmergencyReport.create([
    {
      messageId: 'audit-merge-a',
      originalSenderId: user._id,
      uploaderId: user._id,
      emergencyType: 'flood',
      severity: 'HIGH',
      location: { type: 'Point', coordinates: [77.6, 12.97] },
      timestamp: new Date(),
      clusterId: source._id,
    },
    {
      messageId: 'audit-merge-b',
      originalSenderId: user._id,
      uploaderId: user._id,
      emergencyType: 'flood',
      severity: 'MEDIUM',
      location: { type: 'Point', coordinates: [77.601, 12.971] },
      timestamp: new Date(),
      clusterId: target._id,
    },
  ]);

  const mutations = [
    {
      action: 'user.block',
      call: () =>
        request(app)
          .post('/admin/block-user')
          .set(auth)
          .send({ userId: String(user._id), reason: 'abuse' }),
    },
    {
      action: 'user.unblock',
      call: () =>
        request(app)
          .post('/admin/unblock-user')
          .set(auth)
          .send({ userId: String(user._id) }),
    },
    {
      action: 'cluster.verify',
      call: () =>
        request(app)
          .post('/admin/verify-cluster')
          .set(auth)
          .send({ clusterId: 'CLUSTER-AUDITTGT' }),
    },
    {
      action: 'cluster.merge',
      call: () =>
        request(app)
          .post('/admin/merge-clusters')
          .set(auth)
          .send({
            sourceClusterId: 'CLUSTER-AUDITSRC',
            targetClusterId: 'CLUSTER-AUDITTGT',
          }),
    },
  ];

  for (const { action, call } of mutations) {
    const before = await countLogs(admin._id, action, new Date(0));
    const since = new Date();
    const res = await call();
    assert(
      res.status === 200,
      `${action} expected 200, got ${res.status}: ${JSON.stringify(res.body)}`
    );

    const afterTotal = await countLogs(admin._id, action, new Date(0));
    const created = await countLogs(admin._id, action, since);

    assert(
      afterTotal - before === 1,
      `${action}: expected +1 AuditLog (before=${before}, after=${afterTotal})`
    );
    assert(
      created === 1,
      `${action}: expected exactly 1 new AuditLog since call, got ${created}`
    );
    console.log(`[verify] ${action} => 200, AuditLog +1 ✓`);
  }

  // Read endpoints smoke check
  const summary = await request(app)
    .get('/admin/dashboard-summary')
    .set(auth);
  assert(summary.status === 200, `dashboard-summary => ${summary.status}`);
  assert(
    typeof summary.body.data.activeEmergencies === 'number',
    'dashboard-summary missing activeEmergencies'
  );
  assert(
    typeof summary.body.data.clustersToday === 'number',
    'dashboard-summary missing clustersToday'
  );
  console.log('[verify] GET /admin/dashboard-summary => 200 ✓');

  console.log(
    '[verify] PASS — every mutating admin route produced exactly one AuditLog'
  );

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
