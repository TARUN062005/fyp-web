/**
 * Confirms two uploads with the same messageId (two relay devices) produce
 * exactly one EmergencyReport document.
 *
 * Usage: npm run verify:upload-idempotency
 */
import mongoose from 'mongoose';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import { issueTokenPair } from '../services/tokenService.js';

const MESSAGE_ID = `msg-idempotency-${Date.now()}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const ensureUser = async (marker, emergencyId) => {
  await User.deleteMany({ googleAccountId: marker });
  return User.create({
    googleAccountId: marker,
    emergencyId,
    displayName: marker,
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const sender = await ensureUser('upload-idem-sender', 'EDTN-UIDS1');
  const relayA = await ensureUser('upload-idem-relay-a', 'EDTN-UIDA1');
  const relayB = await ensureUser('upload-idem-relay-b', 'EDTN-UIDB1');

  await EmergencyReport.deleteMany({ messageId: MESSAGE_ID });

  const tokenA = (await issueTokenPair(relayA._id)).accessToken;
  const tokenB = (await issueTokenPair(relayB._id)).accessToken;

  const bodyFor = (uploaderId, hopCount = 1) => ({
    messageId: MESSAGE_ID,
    originalSenderId: String(sender._id),
    uploaderId: String(uploaderId),
    emergencyType: 'flood',
    severity: 'high',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    timestamp: new Date().toISOString(),
    hopCount,
  });

  const first = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${tokenA}`)
    .send(bodyFor(relayA._id, 2));

  assert(first.status === 201, `first upload expected 201, got ${first.status}`);
  assert(first.body.data.created === true, 'first upload should create');
  assert(
    first.body.data.report.messageId === MESSAGE_ID,
    'first upload messageId mismatch'
  );
  assert(first.body.data.report.uploadCount === 1, 'first uploadCount should be 1');
  assert(first.body.data.report.relayCount === 1, 'first relayCount should be 1');
  console.log(`[verify] relay A upload => ${first.status} created=true`);

  const second = await request(app)
    .post('/sos/upload')
    .set('Authorization', `Bearer ${tokenB}`)
    .send(bodyFor(relayB._id, 4));

  assert(second.status === 200, `second upload expected 200, got ${second.status}`);
  assert(second.body.data.deduplicated === true, 'second upload should dedupe');
  assert(second.body.data.created === false, 'second upload must not create');
  assert(
    second.body.data.report.id === first.body.data.report.id,
    'second upload returned a different report id'
  );
  assert(second.body.data.report.uploadCount === 2, 'uploadCount should be 2');
  assert(second.body.data.report.relayCount === 2, 'relayCount should be 2');
  assert(second.body.data.report.hopCount === 4, 'hopCount should be max(2,4)=4');
  assert(
    (second.body.data.report.uploaders || []).length === 2,
    'uploaders should list both relays'
  );
  console.log(`[verify] relay B upload => ${second.status} deduplicated=true`);

  const count = await EmergencyReport.countDocuments({ messageId: MESSAGE_ID });
  assert(count === 1, `expected exactly 1 EmergencyReport, found ${count}`);

  console.log(
    `[verify] PASS — messageId ${MESSAGE_ID} has exactly one EmergencyReport with merged stats`
  );

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
