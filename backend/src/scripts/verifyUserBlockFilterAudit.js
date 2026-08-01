/**
 * Block a user → appears in GET /admin/users?isBlocked=true and
 * GET /admin/audit-logs?action=user.block.
 *
 * Usage: npm run verify:user-block-audit
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'user-block-audit@dtnemergency.local';
const REASON = 'verify-user-block-audit';

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('UserBlockAudit1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const marker = `user-block-${Date.now()}`;
  const emergencyId = 'EDTN-UBLK1';
  await User.deleteMany({
    $or: [{ googleAccountId: marker }, { emergencyId }],
  });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId,
    displayName: 'Block Audit Target',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
    isBlocked: false,
  });

  // Cleanup prior audit noise for this target from older runs
  await AuditLog.deleteMany({
    targetId: String(user._id),
    action: { $in: ['user.block', 'user.unblock'] },
  });

  const beforeBlocked = await request(app)
    .get('/admin/users')
    .query({ isBlocked: true, q: emergencyId })
    .set(auth);
  assert(beforeBlocked.status === 200, `blocked filter before => ${beforeBlocked.status}`);
  assert(
    !(beforeBlocked.body.data.users || []).some((u) => u.id === String(user._id)),
    'user should not appear in blocked filter before block'
  );
  console.log('[verify] blocked filter empty for target before block ✓');

  const blockRes = await request(app)
    .post('/admin/block-user')
    .set(auth)
    .send({ userId: String(user._id), reason: REASON });
  assert(blockRes.status === 200, `block => ${blockRes.status}`);
  assert(blockRes.body.data.user.isBlocked === true, 'block response not blocked');
  console.log('[verify] POST /admin/block-user => 200 ✓');

  const afterBlocked = await request(app)
    .get('/admin/users')
    .query({ isBlocked: true, q: emergencyId })
    .set(auth);
  assert(afterBlocked.status === 200, `blocked filter after => ${afterBlocked.status}`);
  const hit = (afterBlocked.body.data.users || []).find(
    (u) => u.id === String(user._id)
  );
  assert(hit, 'blocked user missing from blocked filter');
  assert(hit.isBlocked === true, 'filter row not marked blocked');
  assert(hit.emergencyId === emergencyId, 'emergencyId mismatch');
  console.log(
    `[verify] blocked filter + search (${emergencyId}) returns user ✓`
  );

  // Search by display name under blocked filter
  const byName = await request(app)
    .get('/admin/users')
    .query({ isBlocked: true, q: 'Block Audit' })
    .set(auth);
  assert(
    (byName.body.data.users || []).some((u) => u.id === String(user._id)),
    'search by display name missed blocked user'
  );
  console.log('[verify] blocked filter + display-name search ✓');

  const auditRes = await request(app)
    .get('/admin/audit-logs')
    .query({ action: 'user.block', limit: 20 })
    .set(auth);
  assert(auditRes.status === 200, `audit-logs => ${auditRes.status}`);
  const log = (auditRes.body.data.logs || []).find(
    (l) =>
      l.action === 'user.block' &&
      l.targetId === String(user._id) &&
      l.metadata?.reason === REASON
  );
  assert(log, 'audit log missing user.block for this user/reason');
  assert(log.targetType === 'User', `targetType=${log.targetType}`);
  assert(String(log.adminId) === String(admin._id), 'audit adminId mismatch');
  console.log(
    `[verify] GET /admin/audit-logs?action=user.block includes entry ✓`
  );

  console.log(
    '[verify] PASS — blocked user appears in blocked filter and audit log'
  );

  await AuditLog.deleteMany({
    targetId: String(user._id),
    action: { $in: ['user.block', 'user.unblock'] },
  });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
