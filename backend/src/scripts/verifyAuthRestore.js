/**
 * Confirms second install with the same Google account returns the SAME
 * emergencyId (restore), not a new identity.
 *
 * Usage: node src/scripts/verifyAuthRestore.js
 * Requires: GOOGLE_AUTH_MOCK=true and NODE_ENV !== production
 */
import mongoose from 'mongoose';
import env from '../config/env.js';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import IdentityCertificate from '../models/IdentityCertificate.js';
import { authenticateWithGoogle } from '../services/authService.js';

const GOOGLE_ID = 'restore-test-google-subject-001';
const DISPLAY = 'Restore Test User';
const PUBLIC_KEY = 'test-public-key-pem-or-b64-install-1';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  if (!env.googleAuthMock) {
    throw new Error('Set GOOGLE_AUTH_MOCK=true in .env before running this script');
  }

  await mongoose.connect(env.mongoUri);

  await User.deleteMany({ googleAccountId: GOOGLE_ID });

  const mockToken = `mock:${GOOGLE_ID}:${DISPLAY}`;

  // --- Install 1: Google + publicKey → create identity + certificate ---
  const MESH_USER_ID = 'a'.repeat(64);

  const created = await authenticateWithGoogle(mockToken, {
    publicKey: PUBLIC_KEY,
    meshUserId: MESH_USER_ID,
  });

  assert(created.status === 'created', `Install 1 expected created, got ${created.status}`);
  assert(created.profile?.emergencyId, 'Install 1 missing emergencyId');
  assert(
    created.identityCertificate?.serverSignature,
    'Install 1 missing IdentityCertificate from B4b'
  );
  assert(created.accessToken && created.refreshToken, 'Install 1 missing JWT pair');
  assert(created.userId, 'Install 1 missing Mongo userId on session');
  assert(created.meshUserId === MESH_USER_ID, 'Install 1 missing meshUserId');
  assert(created.profile.isVerified === true, 'Install 1 should be verified');

  const emergencyId1 = created.profile.emergencyId;
  console.log(`[verify] Install 1 emergencyId = ${emergencyId1}`);

  const storedRefresh = await RefreshToken.countDocuments({
    userId: (await User.findOne({ emergencyId: emergencyId1 }))._id,
  });
  assert(storedRefresh >= 1, 'Refresh token was not stored (hashed) in MongoDB');

  // --- Install 2: same Google account → must RESTORE same emergencyId ---
  const google2 = await authenticateWithGoogle(mockToken, {
    publicKey: 'install-2-new-device-key',
    meshUserId: 'b'.repeat(64),
  });
  assert(google2.status === 'restored', `Install 2 Google expected restored, got ${google2.status}`);
  assert(
    google2.profile.emergencyId === emergencyId1,
    `Install 2 Google restore mismatch: ${google2.profile.emergencyId} !== ${emergencyId1}`
  );
  assert(
    google2.meshUserId === MESH_USER_ID,
    `Install 2 meshUserId changed: ${google2.meshUserId}`
  );
  assert(google2.profile.isVerified === true, 'Install 2 should keep verified');
  console.log(
    `[verify] Install 2 Google restore emergencyId = ${google2.profile.emergencyId}`
  );

  const count = await User.countDocuments({ googleAccountId: GOOGLE_ID });
  assert(count === 1, `Expected exactly 1 user, found ${count}`);

  const certCount = await IdentityCertificate.countDocuments({
    emergencyId: emergencyId1,
  });
  assert(certCount >= 1, 'Expected at least one IdentityCertificate');

  console.log('[verify] PASS — second install restored the same emergencyId');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
