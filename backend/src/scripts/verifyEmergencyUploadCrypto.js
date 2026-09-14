/**
 * Cloud emergency Ed25519 / provenance / TTL / race coverage.
 *
 * Usage: node src/scripts/verifyEmergencyUploadCrypto.js
 */
import mongoose from 'mongoose';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import { issueTokenPair } from '../services/tokenService.js';
import {
  buildSignedEmergencyUpload,
  fingerprintPublicKey,
  generateEmergencyKeyPair,
} from '../tests/helpers/signedEmergencyUpload.js';
import { signEmergencyCloud } from '../security/emergencyCanonical.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const ensureUser = async (marker, emergencyId, keyPair) => {
  await User.deleteMany({ googleAccountId: marker });
  return User.create({
    googleAccountId: marker,
    emergencyId,
    displayName: marker,
    publicKey: keyPair.publicKeyBase64,
    publicKeyFingerprint: fingerprintPublicKey(keyPair.publicKeyBase64),
    isVerified: true,
  });
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const originKeys = generateEmergencyKeyPair();
  const relayKeys = generateEmergencyKeyPair();
  const otherKeys = generateEmergencyKeyPair();

  const origin = await ensureUser('crypto-origin', 'EDTN-CRYO1', originKeys);
  const relay = await ensureUser('crypto-relay', 'EDTN-CRYR1', relayKeys);
  const other = await ensureUser('crypto-other', 'EDTN-CRYO2', otherKeys);

  const originToken = (await issueTokenPair(origin._id)).accessToken;
  const relayToken = (await issueTokenPair(relay._id)).accessToken;
  const otherToken = (await issueTokenPair(other._id)).accessToken;

  const prefix = `crypto-${Date.now()}`;
  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${prefix}`) });

  const base = {
    keyPair: originKeys,
    senderId: `mesh-${origin._id}`,
    originalSenderId: String(origin._id),
    longitude: 77.5946,
    latitude: 12.9716,
    emergencyType: 'sos',
    severity: 'CRITICAL',
  };

  const selfId = `${prefix}-self`;
  const selfBody = buildSignedEmergencyUpload({
    ...base,
    messageId: selfId,
    uploaderId: String(origin._id),
  });
  const selfRes = await request(app)
    .post('/sos/upload')
    .set('Authorization', `Bearer ${originToken}`)
    .send(selfBody);
  assert(selfRes.status === 201, `self upload expected 201, got ${selfRes.status} ${selfRes.body?.error?.message}`);
  assert(selfRes.body.data.created === true, 'self upload should create');
  assert(
    selfRes.body.data.report.originalSenderId === String(origin._id),
    'self originalSenderId mismatch'
  );
  assert(
    selfRes.body.data.report.uploaderId === String(origin._id),
    'self uploaderId mismatch'
  );
  console.log('[verify] valid self-originated + signature => 201 ✓');

  const relayId = `${prefix}-relay`;
  const relayBody = buildSignedEmergencyUpload({
    ...base,
    messageId: relayId,
    uploaderId: String(relay._id),
    hopCount: 2,
  });
  const relayRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(relayBody);
  assert(relayRes.status === 201, `relay upload expected 201, got ${relayRes.status} ${relayRes.body?.error?.message}`);
  assert(
    relayRes.body.data.report.originalSenderId === String(origin._id),
    'relay must keep original sender'
  );
  assert(
    relayRes.body.data.report.uploaderId === String(relay._id),
    'relay uploaderId must be JWT user'
  );
  console.log('[verify] relay upload for different original sender => 201 ✓');

  const badSig = {
    ...relayBody,
    messageId: `${prefix}-badsig`,
    signature: Buffer.alloc(64, 7).toString('base64'),
  };
  const badSigRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(badSig);
  assert(badSigRes.status === 400, `invalid signature expected 400, got ${badSigRes.status}`);
  console.log('[verify] invalid signature => 400 ✓');

  const tampered = {
    ...buildSignedEmergencyUpload({
      ...base,
      messageId: `${prefix}-tamper`,
      uploaderId: String(relay._id),
    }),
  };
  tampered.emergencyType = 'fire';
  const tamperRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(tampered);
  assert(tamperRes.status === 400, `modified type expected 400, got ${tamperRes.status}`);
  console.log('[verify] modified emergency content/type => 400 ✓');

  const spoofOrigin = buildSignedEmergencyUpload({
    ...base,
    messageId: `${prefix}-spoof-origin`,
    originalSenderId: String(other._id),
    uploaderId: String(relay._id),
  });
  const spoofOriginRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(spoofOrigin);
  assert(
    spoofOriginRes.status === 403,
    `modified original sender expected 403, got ${spoofOriginRes.status}`
  );
  console.log('[verify] modified original sender identity => 403 ✓');

  const spoofUploader = buildSignedEmergencyUpload({
    ...base,
    messageId: `${prefix}-spoof-up`,
    uploaderId: String(other._id),
  });
  const spoofUpRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(spoofUploader);
  assert(
    spoofUpRes.status === 403,
    `spoofed uploaderId expected 403, got ${spoofUpRes.status}`
  );
  console.log('[verify] uploaderId cannot be spoofed => 403 ✓');

  const expired = buildSignedEmergencyUpload({
    ...base,
    messageId: `${prefix}-expired`,
    uploaderId: String(relay._id),
    timestampMs: Date.now() - 30 * 60 * 60 * 1000,
    ttl: 86_400_000,
  });
  const expiredRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(expired);
  assert(expiredRes.status === 400, `expired expected 400, got ${expiredRes.status}`);
  assert(
    expiredRes.body?.error?.code === 'EMERGENCY_EXPIRED',
    `expected EMERGENCY_EXPIRED, got ${expiredRes.body?.error?.code}`
  );
  console.log('[verify] expired emergency => 400 ✓');

  const badTtl = buildSignedEmergencyUpload({
    ...base,
    messageId: `${prefix}-badttl`,
    uploaderId: String(relay._id),
  });
  badTtl.ttl = 0;
  badTtl.signature = signEmergencyCloud(originKeys.privateKey, badTtl);
  const badTtlRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(badTtl);
  assert(badTtlRes.status === 400, `invalid ttl expected 400, got ${badTtlRes.status}`);
  console.log('[verify] invalid TTL => 400 ✓');

  const dupId = `${prefix}-dup`;
  const dupA = buildSignedEmergencyUpload({
    ...base,
    messageId: dupId,
    uploaderId: String(relay._id),
    hopCount: 1,
  });
  const firstDup = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(dupA);
  assert(firstDup.status === 201, `dup first expected 201, got ${firstDup.status}`);
  const dupB = buildSignedEmergencyUpload({
    ...base,
    messageId: dupId,
    uploaderId: String(other._id),
    hopCount: 3,
  });
  const secondDup = await request(app)
    .post('/sos/upload')
    .set('Authorization', `Bearer ${otherToken}`)
    .send(dupB);
  assert(secondDup.status === 200, `dup second expected 200, got ${secondDup.status}`);
  assert(secondDup.body.data.deduplicated === true, 'duplicate should be idempotent');
  const dupCount = await EmergencyReport.countDocuments({ messageId: dupId });
  assert(dupCount === 1, `duplicate created ${dupCount} reports`);
  console.log('[verify] duplicate messageId => idempotent ✓');

  const raceId = `${prefix}-race`;
  const raceBodyA = buildSignedEmergencyUpload({
    ...base,
    messageId: raceId,
    uploaderId: String(relay._id),
  });
  const raceBodyB = buildSignedEmergencyUpload({
    ...base,
    messageId: raceId,
    uploaderId: String(other._id),
    hopCount: 2,
  });
  const raced = await Promise.all([
    request(app)
      .post('/broadcast/upload')
      .set('Authorization', `Bearer ${relayToken}`)
      .send(raceBodyA),
    request(app)
      .post('/broadcast/upload')
      .set('Authorization', `Bearer ${otherToken}`)
      .send(raceBodyB),
  ]);
  const statuses = raced.map((r) => r.status).sort();
  assert(
    statuses[0] === 200 && statuses[1] === 201,
    `race expected 200+201, got ${statuses.join(',')}`
  );
  const raceCount = await EmergencyReport.countDocuments({ messageId: raceId });
  assert(raceCount === 1, `race created ${raceCount} reports`);
  console.log('[verify] simultaneous duplicate uploads => one report ✓');

  const malformed = buildSignedEmergencyUpload({
    ...base,
    messageId: `${prefix}-malformed`,
    uploaderId: String(relay._id),
  });
  malformed.senderPublicKey = 'not-a-key';
  const malformedRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(malformed);
  assert(malformedRes.status === 400, `malformed crypto expected 400, got ${malformedRes.status}`);
  console.log('[verify] malformed crypto fields => 400 ✓');

  const unknownKeys = generateEmergencyKeyPair();
  const unknownBody = buildSignedEmergencyUpload({
    keyPair: unknownKeys,
    messageId: `${prefix}-unknown`,
    senderId: 'mesh-unknown',
    uploaderId: String(relay._id),
    longitude: 77.5946,
    latitude: 12.9716,
    emergencyType: 'sos',
    severity: 'HIGH',
  });
  const unknownRes = await request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${relayToken}`)
    .send(unknownBody);
  assert(
    unknownRes.status === 422,
    `unregistered origin expected 422, got ${unknownRes.status}`
  );
  assert(
    unknownRes.body?.error?.code === 'ORIGIN_NOT_REGISTERED',
    `expected ORIGIN_NOT_REGISTERED, got ${unknownRes.body?.error?.code}`
  );
  console.log('[verify] origin with no backend user => 422 ORIGIN_NOT_REGISTERED ✓');

  console.log('[verify] PASS — emergency cloud crypto + provenance + TTL + race');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
