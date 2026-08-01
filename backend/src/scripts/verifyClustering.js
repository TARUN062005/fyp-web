/**
 * Clustering coverage:
 * - nearby + close-in-time reports merge into one cluster
 * - far-away reports do NOT merge
 * - outside time window do NOT merge
 *
 * Usage: node src/scripts/verifyClustering.js
 */
import mongoose from 'mongoose';
import request from 'supertest';
import env from '../config/env.js';
import app from '../app.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import EmergencyCluster from '../models/EmergencyCluster.js';
import { issueTokenPair } from '../services/tokenService.js';
import { CLUSTER_TIME_WINDOW_MS } from '../config/clustering.js';

const TYPE = 'other';
const BASE_LNG = 77.5946;
const BASE_LAT = 12.9716;

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

const upload = async (token, body) =>
  request(app)
    .post('/broadcast/upload')
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const sender = await ensureUser('cluster-cov-sender', 'EDTN-CLCS1');
  const uploader = await ensureUser('cluster-cov-uploader', 'EDTN-CLCU1');
  const token = (await issueTokenPair(uploader._id)).accessToken;
  const prefix = `cluster-cov-${Date.now()}`;
  const now = Date.now();

  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${prefix}`) });
  await EmergencyCluster.deleteMany({
    emergencyType: TYPE,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [BASE_LNG, BASE_LAT] },
        $maxDistance: 25_000,
      },
    },
  });

  // --- Merge: 3 nearby, same type, close in time ---
  const nearIds = [];
  for (let i = 0; i < 3; i += 1) {
    const messageId = `${prefix}-near-${i}`;
    nearIds.push(messageId);
    const res = await upload(token, {
      messageId,
      originalSenderId: String(sender._id),
      uploaderId: String(uploader._id),
      emergencyType: TYPE,
      severity: 'MEDIUM',
      location: {
        type: 'Point',
        coordinates: [BASE_LNG + i * 0.0003, BASE_LAT + i * 0.0002],
      },
      timestamp: new Date(now + i * 1000).toISOString(),
    });
    assert(res.status === 201, `near upload ${i} => ${res.status}`);
  }

  const nearReports = await EmergencyReport.find({
    messageId: { $in: nearIds },
  }).lean();
  const nearClusterIds = [
    ...new Set(nearReports.map((r) => String(r.clusterId))),
  ];
  assert(nearClusterIds.length === 1, `expected 1 near cluster, got ${nearClusterIds.length}`);
  const nearCluster = await EmergencyCluster.findById(nearClusterIds[0]);
  assert(nearCluster.reportCount === 3, `near reportCount=${nearCluster.reportCount}`);
  console.log(`[verify] MERGE — ${nearCluster.clusterId} reportCount=3 ✓`);

  // --- No merge: far outside radius (~5km) ---
  const farId = `${prefix}-far`;
  const farRes = await upload(token, {
    messageId: farId,
    originalSenderId: String(sender._id),
    uploaderId: String(uploader._id),
    emergencyType: TYPE,
    severity: 'MEDIUM',
    location: {
      type: 'Point',
      coordinates: [BASE_LNG + 0.05, BASE_LAT + 0.05],
    },
    timestamp: new Date(now + 5000).toISOString(),
  });
  assert(farRes.status === 201, `far upload => ${farRes.status}`);
  const farReport = await EmergencyReport.findOne({ messageId: farId });
  assert(
    String(farReport.clusterId) !== String(nearCluster._id),
    'far report incorrectly joined near cluster'
  );
  console.log('[verify] NO-MERGE (radius) — far report got its own cluster ✓');

  // --- No merge: outside time window (same location as near cluster) ---
  // Push the near cluster's lastReportAt far into the past
  await EmergencyCluster.updateOne(
    { _id: nearCluster._id },
    {
      $set: {
        lastReportAt: new Date(now - CLUSTER_TIME_WINDOW_MS - 60_000),
        firstReportAt: new Date(now - CLUSTER_TIME_WINDOW_MS - 120_000),
      },
    }
  );

  const staleId = `${prefix}-stale-window`;
  const staleRes = await upload(token, {
    messageId: staleId,
    originalSenderId: String(sender._id),
    uploaderId: String(uploader._id),
    emergencyType: TYPE,
    severity: 'MEDIUM',
    location: {
      type: 'Point',
      coordinates: [BASE_LNG, BASE_LAT],
    },
    timestamp: new Date(now + 8000).toISOString(),
  });
  assert(staleRes.status === 201, `stale-window upload => ${staleRes.status}`);
  const staleReport = await EmergencyReport.findOne({ messageId: staleId });
  assert(
    String(staleReport.clusterId) !== String(nearCluster._id),
    'time-window report incorrectly joined stale cluster'
  );
  console.log('[verify] NO-MERGE (time window) — fresh report got a new cluster ✓');

  console.log('[verify] PASS — clustering merge + non-merge coverage');
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
