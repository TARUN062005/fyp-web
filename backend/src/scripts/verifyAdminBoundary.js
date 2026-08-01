/**
 * Confirms mobile JWTs are rejected by admin routes and admin JWTs are
 * rejected by mobile routes — token types must not be interchangeable.
 *
 * Usage: npm run verify:admin-boundary
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import { issueTokenPair } from '../services/tokenService.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'boundary-test-admin@dtnemergency.local';
const ADMIN_PASSWORD = 'BoundaryTestPass123!';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    role: 'admin',
  });

  const marker = `boundary-mobile-google`;
  await User.deleteMany({ googleAccountId: marker });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-BOUND',
    displayName: 'Boundary Mobile',
    publicKey: 'boundary-pk',
    publicKeyFingerprint: 'boundary-fp',
    isVerified: true,
  });

  const mobileTokens = await issueTokenPair(user._id);
  const adminTokens = await issueAdminTokenPair(admin._id, admin.role);

  // Mobile token → admin route must fail
  const mobileOnAdmin = await request(app)
    .get('/admin/me')
    .set('Authorization', `Bearer ${mobileTokens.accessToken}`);
  assert(
    mobileOnAdmin.status === 401,
    `Expected 401 for mobile token on /admin/me, got ${mobileOnAdmin.status}`
  );
  console.log('[verify] mobile JWT → /admin/me = 401 ✓');

  // Admin token → mobile route must fail
  const adminOnMobile = await request(app)
    .get('/profile')
    .set('Authorization', `Bearer ${adminTokens.accessToken}`);
  assert(
    adminOnMobile.status === 401,
    `Expected 401 for admin token on /profile, got ${adminOnMobile.status}`
  );
  console.log('[verify] admin JWT → /profile = 401 ✓');

  // Correct pairings succeed
  const adminOk = await request(app)
    .get('/admin/me')
    .set('Authorization', `Bearer ${adminTokens.accessToken}`);
  assert(adminOk.status === 200, `Expected 200 for admin on /admin/me, got ${adminOk.status}`);
  console.log('[verify] admin JWT → /admin/me = 200 ✓');

  const mobileOk = await request(app)
    .get('/profile')
    .set('Authorization', `Bearer ${mobileTokens.accessToken}`);
  assert(
    mobileOk.status === 200,
    `Expected 200 for mobile on /profile, got ${mobileOk.status}`
  );
  console.log('[verify] mobile JWT → /profile = 200 ✓');

  // Login endpoint sanity
  const login = await request(app)
    .post('/admin/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert(login.status === 200, `Admin login failed: ${login.status}`);
  assert(login.body.data?.accessToken, 'Admin login missing accessToken');
  console.log('[verify] POST /admin/auth/login = 200 ✓');

  console.log('[verify] PASS — admin and mobile JWTs are not interchangeable');

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
