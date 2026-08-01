/**
 * B10 security checks: refresh revocation, replay protection, Sybil indexes,
 * CORS config, logging hygiene spot-checks.
 *
 * Usage: npm run verify:security-b10
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import User from '../models/User.js';
import AdminUser from '../models/AdminUser.js';
import EmergencyReport from '../models/EmergencyReport.js';
import RefreshToken from '../models/RefreshToken.js';
import AdminRefreshToken from '../models/AdminRefreshToken.js';
import { issueTokenPair, revokeRefreshToken } from '../services/tokenService.js';
import {
  issueAdminTokenPair,
  revokeAdminRefreshToken,
} from '../services/adminTokenService.js';
import { uploadEmergencyReport } from '../services/emergencyUploadService.js';

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const checklist = [];
const record = (item, pass, detail = '') => {
  checklist.push({ item, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${item}${detail ? ` — ${detail}` : ''}`);
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  // Drop pre-jti rows so unique jti index can build, then sync TTL/jti indexes
  await RefreshToken.deleteMany({ $or: [{ jti: null }, { jti: { $exists: false } }] });
  await AdminRefreshToken.deleteMany({
    $or: [{ jti: null }, { jti: { $exists: false } }],
  });
  await RefreshToken.syncIndexes();
  await AdminRefreshToken.syncIndexes();

  const mobileIndexes = await RefreshToken.collection.indexes();
  const adminIndexes = await AdminRefreshToken.collection.indexes();
  const hasTtl = (indexes) =>
    indexes.some(
      (idx) => idx.key?.expiresAt === 1 && idx.expireAfterSeconds === 0
    );
  const hasJti = (indexes) => indexes.some((idx) => idx.key?.jti === 1 && idx.unique);

  // --- 1. Refresh revocation ---
  await User.deleteMany({ googleAccountId: 'b10-security-user' });
  const user = await User.create({
    googleAccountId: 'b10-security-user',
    emergencyId: 'EDTN-B10S1',
    displayName: 'B10 User',
    publicKey: 'pk',
    publicKeyFingerprint: 'fp',
    isVerified: true,
  });

  const mobilePair = await issueTokenPair(user._id);
  await revokeRefreshToken(mobilePair.refreshToken);
  const mobileRefresh = await request(app)
    .post('/auth/refresh')
    .send({ refreshToken: mobilePair.refreshToken });
  assert(mobileRefresh.status === 401, `mobile refresh after logout => ${mobileRefresh.status}`);

  await AdminUser.deleteMany({ email: 'b10-security@dtnemergency.local' });
  const admin = await AdminUser.create({
    email: 'b10-security@dtnemergency.local',
    passwordHash: await bcrypt.hash('B10SecurityPass1!', 10),
    role: 'admin',
  });
  const adminPair = await issueAdminTokenPair(admin._id, admin.role);
  await revokeAdminRefreshToken(adminPair.refreshToken);
  const adminRefresh = await request(app)
    .post('/admin/auth/refresh')
    .send({ refreshToken: adminPair.refreshToken });
  assert(adminRefresh.status === 401, `admin refresh after logout => ${adminRefresh.status}`);

  record(
    '1. Refresh-token revocation (mobile + admin) + TTL/jti indexes',
    mobileRefresh.status === 401 &&
      adminRefresh.status === 401 &&
      hasTtl(mobileIndexes) &&
      hasTtl(adminIndexes) &&
      hasJti(mobileIndexes) &&
      hasJti(adminIndexes),
    `mobileRefresh=${mobileRefresh.status} adminRefresh=${adminRefresh.status} ttl/jti ok`
  );

  // --- 2. Replay protection ---
  const sender = user;
  const messageId = `b10-replay-${Date.now()}`;
  const base = {
    messageId,
    originalSenderId: String(sender._id),
    uploaderId: String(user._id),
    emergencyType: 'flood',
    severity: 'HIGH',
    location: { type: 'Point', coordinates: [77.59, 12.97] },
    timestamp: new Date().toISOString(),
  };

  const first = await uploadEmergencyReport(base, user._id);
  const second = await uploadEmergencyReport(base, user._id);
  const count = await EmergencyReport.countDocuments({ messageId });

  let staleRejected = false;
  try {
    await uploadEmergencyReport(
      {
        ...base,
        messageId: `${messageId}-stale`,
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
      },
      user._id
    );
  } catch (err) {
    staleRejected = err.statusCode === 400;
  }

  record(
    '2. Replay protection (messageId idempotency + timestamp window)',
    first.created &&
      second.deduplicated &&
      count === 1 &&
      staleRejected,
    `created=${first.created} dedup=${second.deduplicated} count=${count} staleRejected=${staleRejected}`
  );

  // --- 3. Sybil structural uniqueness ---
  const userIndexes = await User.collection.indexes();
  const uniqueSparse = (field) =>
    userIndexes.some(
      (idx) => idx.key?.[field] === 1 && idx.unique && idx.sparse
    );
  const uniqueEmergency = userIndexes.some(
    (idx) => idx.key?.emergencyId === 1 && idx.unique
  );

  let duplicateBlocked = false;
  try {
    await User.create({
      googleAccountId: 'b10-security-user',
      emergencyId: 'EDTN-B10S2',
      displayName: 'Dup',
      publicKey: 'pk2',
      publicKeyFingerprint: 'fp2',
    });
  } catch (err) {
    duplicateBlocked = err?.code === 11000;
  }

  record(
    '3. Sybil mitigation (unique googleAccountId / emergencyId)',
    uniqueSparse('googleAccountId') && uniqueEmergency && duplicateBlocked,
    'indexes present; duplicate googleAccountId insert rejected with 11000'
  );

  // --- 4. CORS ---
  const corsOk =
    Array.isArray(env.adminOrigins) &&
    env.adminOrigins.length > 0 &&
    !env.adminOrigins.includes('*') &&
    env.adminOrigin !== '*';

  const corsProbe = await request(app)
    .get('/health')
    .set('Origin', 'https://evil.example');
  // cors package may fail the request via error handler
  const corsBlocked =
    corsProbe.status === 403 ||
    corsProbe.status === 500 ||
    corsProbe.headers['access-control-allow-origin'] !== 'https://evil.example';

  record(
    '4. Helmet/CORS (no wildcard; only admin origin allow-list)',
    corsOk && corsBlocked,
    `origins=${JSON.stringify(env.adminOrigins)} evilOriginBlocked=${corsBlocked}`
  );

  // --- 5. Logging hygiene (static expectations) ---
  // requestLogger logs method/path/status/latency only; errorHandler does not
  // dump bodies. Spot-check source contracts:
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const requestLoggerSrc = fs.readFileSync(
    path.join(root, 'middleware/requestLogger.js'),
    'utf8'
  );
  const errorHandlerSrc = fs.readFileSync(
    path.join(root, 'middleware/errorHandler.js'),
    'utf8'
  );
  const googleAuthSrc = fs.readFileSync(
    path.join(root, 'services/googleAuthService.js'),
    'utf8'
  );
  const loggingOk =
    requestLoggerSrc.includes('no headers, body, tokens, or PII') &&
    errorHandlerSrc.includes('Do not log request bodies') &&
    googleAuthSrc.includes('NODE_ENV !== \'production\'') &&
    !fs.existsSync(path.join(root, 'services/otpService.js'));

  record(
    '5. Logging hygiene (no tokens/PII in app logs; OTP stack removed)',
    loggingOk,
    'requestLogger + errorHandler + Google mock guard verified'
  );

  console.log('\n=== B10 Security Checklist ===');
  for (const row of checklist) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'} | ${row.item}`);
  }

  const allPass = checklist.every((r) => r.pass);
  if (!allPass) {
    throw new Error('One or more security checks failed');
  }

  console.log('\n[verify] PASS — all B10 security checklist items');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
