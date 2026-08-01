/**
 * Confirms re-associating a new publicKey for the same emergencyId issues a
 * NEW IdentityCertificate (new issuedAt / signature, same emergencyId).
 *
 * Usage: npm run verify:cert-reissue
 */
import mongoose from 'mongoose';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import User from '../models/User.js';
import IdentityCertificate from '../models/IdentityCertificate.js';
import {
  issueCertificate,
  getLatestCertificate,
  verifyCertificateSignature,
  toCertificateDto,
} from '../services/certificateService.js';
import { authenticateWithGoogle } from '../services/authService.js';

const GOOGLE_ID = 'cert-reissue-google-001';
const EMERGENCY_ID = 'EDTN-CREIS';
const KEY_1 = 'device-public-key-v1';
const KEY_2 = 'device-public-key-v2-after-reinstall';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  if (!env.googleAuthMock) {
    throw new Error('Set GOOGLE_AUTH_MOCK=true before running this script');
  }

  await mongoose.connect(env.mongoUri);

  await User.deleteMany({ googleAccountId: GOOGLE_ID });
  await IdentityCertificate.deleteMany({ emergencyId: EMERGENCY_ID });

  const user = await User.create({
    googleAccountId: GOOGLE_ID,
    emergencyId: EMERGENCY_ID,
    displayName: 'Cert Reissue User',
    publicKey: KEY_1,
    publicKeyFingerprint: 'fp1',
    isVerified: true,
  });

  const cert1 = await issueCertificate(EMERGENCY_ID, KEY_1);
  assert(verifyCertificateSignature(cert1), 'cert1 signature invalid');
  console.log(`[verify] cert1 issuedAt=${cert1.issuedAt.toISOString()} key=${cert1.publicKey}`);

  // Ensure issuedAt timestamps can differ
  await sleep(20);

  const restore = await authenticateWithGoogle(`mock:${GOOGLE_ID}:Cert Reissue User`, {
    publicKey: KEY_2,
  });

  assert(restore.status === 'restored', `expected restored, got ${restore.status}`);
  assert(restore.identityCertificate, 'restore did not return a new certificate');
  assert(
    restore.identityCertificate.emergencyId === EMERGENCY_ID,
    'emergencyId changed on reissue'
  );
  assert(
    restore.identityCertificate.publicKey === KEY_2,
    'new certificate did not use KEY_2'
  );
  assert(
    restore.identityCertificate.publicKey !== cert1.publicKey,
    'certificate reused old publicKey'
  );
  assert(
    new Date(restore.identityCertificate.issuedAt).getTime() >
      cert1.issuedAt.getTime(),
    'new certificate did not get a newer issuedAt'
  );
  assert(
    restore.identityCertificate.serverSignature !== cert1.serverSignature,
    'new certificate reused old serverSignature'
  );

  const latest = await getLatestCertificate(EMERGENCY_ID);
  assert(latest.publicKey === KEY_2, 'latest cert in DB is not KEY_2');
  assert(
    verifyCertificateSignature(latest),
    'latest certificate signature failed verification'
  );

  const count = await IdentityCertificate.countDocuments({
    emergencyId: EMERGENCY_ID,
  });
  assert(count === 2, `expected 2 certificates stored, found ${count}`);

  const fetched = await request(app)
    .get('/profile/certificate')
    .set('Authorization', `Bearer ${restore.accessToken}`);
  assert(fetched.status === 200, `GET /profile/certificate => ${fetched.status}`);
  assert(
    fetched.body.data.publicKey === KEY_2,
    'profile/certificate did not return the new certificate'
  );
  assert(
    fetched.body.data.emergencyId === EMERGENCY_ID,
    'profile/certificate emergencyId mismatch'
  );

  // User document updated to new key
  const refreshed = await User.findById(user._id);
  assert(refreshed.publicKey === KEY_2, 'User.publicKey was not updated');

  console.log(
    `[verify] cert2 issuedAt=${new Date(restore.identityCertificate.issuedAt).toISOString()} key=${restore.identityCertificate.publicKey}`
  );
  console.log('[verify] PASS — re-register with new publicKey issued a NEW certificate');
  console.log(
    '[verify] DTO sample:',
    JSON.stringify(toCertificateDto(latest), null, 2)
  );

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
