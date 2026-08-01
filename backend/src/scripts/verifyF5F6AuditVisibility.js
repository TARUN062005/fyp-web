/**
 * F5 verify/merge + F6 block/unblock each produce a visible,
 * correctly-attributed entry on GET /admin/audit-logs.
 *
 * Usage: npm run verify:f5-f6-audit
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyCluster from '../models/EmergencyCluster.js';
import EmergencyReport from '../models/EmergencyReport.js';
import AuditLog from '../models/AuditLog.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'f5f6-audit@dtnemergency.local';
const PREFIX = `f5f6-${Date.now()}`;

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('F5F6AuditPass1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };
  const since = new Date();

  const marker = `${PREFIX}-user`;
  await User.deleteMany({
    $or: [{ googleAccountId: marker }, { emergencyId: 'EDTN-F5F6A' }],
  });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-F5F6A',
    displayName: 'F5 F6 Audit User',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });

  const c1 = `CLUSTER-F5${String(Date.now()).slice(-6)}`;
  const c2 = `CLUSTER-F6${String(Date.now()).slice(-6)}`;
  const now = new Date();
  await EmergencyCluster.deleteMany({ clusterId: { $in: [c1, c2] } });
  await EmergencyCluster.create([
    {
      clusterId: c1,
      emergencyType: 'flood',
      location: { type: 'Point', coordinates: [77.6, 12.9] },
      severity: 'MEDIUM',
      reportCount: 1,
      confidenceScore: 0.4,
      firstReportAt: now,
      lastReportAt: now,
      status: 'unverified',
    },
    {
      clusterId: c2,
      emergencyType: 'flood',
      location: { type: 'Point', coordinates: [77.601, 12.901] },
      severity: 'LOW',
      reportCount: 1,
      confidenceScore: 0.3,
      firstReportAt: now,
      lastReportAt: now,
      status: 'unverified',
    },
  ]);

  const actions = [];

  const block = await request(app)
    .post('/admin/block-user')
    .set(auth)
    .send({ userId: String(user._id), reason: 'f5f6-audit' });
  assert(block.status === 200, `block => ${block.status}`);
  actions.push({ action: 'user.block', targetId: String(user._id) });

  const unblock = await request(app)
    .post('/admin/unblock-user')
    .set(auth)
    .send({ userId: String(user._id) });
  assert(unblock.status === 200, `unblock => ${unblock.status}`);
  actions.push({ action: 'user.unblock', targetId: String(user._id) });

  const verify = await request(app)
    .post('/admin/verify-cluster')
    .set(auth)
    .send({ clusterId: c1 });
  assert(verify.status === 200, `verify => ${verify.status}`);
  actions.push({ action: 'cluster.verify', targetId: c1 });

  const merge = await request(app)
    .post('/admin/merge-clusters')
    .set(auth)
    .send({ sourceClusterId: c2, targetClusterId: c1 });
  assert(merge.status === 200, `merge => ${merge.status}`);
  actions.push({ action: 'cluster.merge', targetId: c1 });

  for (const expected of actions) {
    const res = await request(app)
      .get('/admin/audit-logs')
      .query({
        action: expected.action,
        adminId: String(admin._id),
        limit: 50,
      })
      .set(auth);
    assert(res.status === 200, `audit ${expected.action} => ${res.status}`);
    const hit = (res.body.data.logs || []).find(
      (l) =>
        l.action === expected.action &&
        l.targetId === expected.targetId &&
        l.adminId === String(admin._id) &&
        new Date(l.timestamp) >= since
    );
    assert(hit, `missing visible audit for ${expected.action} → ${expected.targetId}`);
    assert(
      hit.adminEmail === ADMIN_EMAIL,
      `attribution email=${hit.adminEmail}`
    );
    console.log(
      `[verify] ${expected.action} visible, attributed to ${hit.adminEmail} ✓`
    );
  }

  console.log(
    '[verify] PASS — F5/F6 verify, merge, block, unblock all visible in audit logs'
  );

  await AuditLog.deleteMany({
    adminId: admin._id,
    timestamp: { $gte: since },
  });
  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${PREFIX}`) });
  await EmergencyCluster.deleteMany({ clusterId: { $in: [c1, c2] } });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
