import crypto from 'crypto';
import EmergencyCluster from '../models/EmergencyCluster.js';
import EmergencyReport from '../models/EmergencyReport.js';
import {
  CLUSTER_RADIUS_METERS,
  CLUSTER_TIME_WINDOW_MS,
  SEVERITY_RANK,
  RANK_TO_SEVERITY,
  getSeverityProfile,
} from '../config/clustering.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';

const toClusterPayload = (cluster) => ({
  id: String(cluster._id),
  clusterId: cluster.clusterId,
  emergencyType: cluster.emergencyType,
  location: cluster.location,
  severity: cluster.severity,
  reportCount: cluster.reportCount,
  confidenceScore: cluster.confidenceScore,
  firstReportAt: cluster.firstReportAt,
  lastReportAt: cluster.lastReportAt,
  status: cluster.status,
});

const CLUSTER_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

export const normalizeSeverity = (severity) => {
  const key = String(severity || '')
    .trim()
    .toLowerCase();
  if (!(key in SEVERITY_RANK)) {
    return 'MEDIUM';
  }
  return RANK_TO_SEVERITY[SEVERITY_RANK[key]];
};

export const severityRank = (severity) =>
  SEVERITY_RANK[String(severity || '').trim().toLowerCase()] || SEVERITY_RANK.medium;

/**
 * Confidence heuristic (tunable, first-pass).
 *
 * - reportCount raises confidence with diminishing returns
 * - proximity to cluster centre (distMeters / radius) raises confidence when tight
 *
 * Returns a value in [0, 1].
 */
export const computeConfidenceScore = ({
  reportCount,
  distMeters = 0,
  radiusMeters = CLUSTER_RADIUS_METERS,
}) => {
  const countFactor = 1 - Math.exp(-(Number(reportCount) || 1) / 3);
  const proximityFactor =
    radiusMeters <= 0
      ? 1
      : clamp01(1 - Math.max(0, distMeters) / radiusMeters);

  // Single report still gets a non-zero base so CRITICAL SOS isn't stuck at ~0 confidence.
  return clamp01(0.2 + 0.5 * countFactor + 0.3 * proximityFactor);
};

/**
 * Cluster severity scoring function (NOT a single report-count threshold).
 *
 * Inputs:
 *  - maxSenderSeverity: highest individual report severity in the cluster.
 *    The result is never LOWER than this (a lone CRITICAL SOS stays CRITICAL).
 *  - confidenceScore: corroboration / spatial tightness in [0, 1].
 *  - reportCount: number of independent reports (raises confidence, not a gate).
 *  - emergencyType: selects a per-type weight profile (fire/collapse/sos escalate faster).
 *
 * Method:
 *  1. Floor = rank(maxSenderSeverity).
 *  2. Build an escalation score in ~[0, 1]:
 *       score = countWeight * f(reportCount)
 *             + confidenceWeight * confidenceScore
 *             + typeBias
 *     where f(n) = 1 - exp(-n / 4) (diminishing returns).
 *  3. Map score → suggested rank (MEDIUM / HIGH / CRITICAL bands).
 *  4. Return max(floor, suggested) as a severity label.
 *
 * Tune weights in config/clustering.js (EMERGENCY_TYPE_SEVERITY_PROFILES)
 * without changing this control flow.
 */
export const computeClusterSeverity = ({
  maxSenderSeverity,
  confidenceScore,
  reportCount,
  emergencyType,
}) => {
  const floorRank = severityRank(maxSenderSeverity);
  const profile = getSeverityProfile(emergencyType);

  const countFactor = 1 - Math.exp(-(Number(reportCount) || 1) / 4);
  const escalationScore = clamp01(
    profile.countWeight * countFactor +
      profile.confidenceWeight * clamp01(confidenceScore) +
      profile.typeBias
  );

  let suggestedRank = SEVERITY_RANK.low;
  if (escalationScore >= 0.75) suggestedRank = SEVERITY_RANK.critical;
  else if (escalationScore >= 0.5) suggestedRank = SEVERITY_RANK.high;
  else if (escalationScore >= 0.25) suggestedRank = SEVERITY_RANK.medium;

  const finalRank = Math.max(floorRank, suggestedRank);
  return RANK_TO_SEVERITY[finalRank];
};

const generateClusterId = () => {
  let suffix = '';
  for (let i = 0; i < 8; i += 1) {
    suffix +=
      CLUSTER_ID_ALPHABET[crypto.randomInt(0, CLUSTER_ID_ALPHABET.length)];
  }
  return `CLUSTER-${suffix}`;
};

const createClusterWithUniqueId = async (fields) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clusterId = generateClusterId();
    try {
      return await EmergencyCluster.create({ ...fields, clusterId });
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.clusterId) continue;
      throw err;
    }
  }
  throw new Error('Could not allocate a unique clusterId');
};

/**
 * Find nearest active cluster of the same type within radius + time window.
 * Uses the 2dsphere index via $geoNear.
 */
export const findMatchingCluster = async (report) => {
  const reportTime = new Date(report.timestamp).getTime();
  const windowStart = new Date(reportTime - CLUSTER_TIME_WINDOW_MS);
  const windowEnd = new Date(reportTime + CLUSTER_TIME_WINDOW_MS);

  const matches = await EmergencyCluster.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: report.location.coordinates,
        },
        distanceField: 'distMeters',
        maxDistance: CLUSTER_RADIUS_METERS,
        spherical: true,
        key: 'location',
        query: {
          emergencyType: report.emergencyType,
          status: { $in: ['unverified', 'verified'] },
          lastReportAt: { $gte: windowStart, $lte: windowEnd },
        },
      },
    },
    { $limit: 1 },
  ]);

  return matches[0] || null;
};

const maxSeverityAmong = (severities) => {
  let best = 'LOW';
  let bestRank = 0;
  for (const s of severities) {
    const rank = severityRank(s);
    if (rank > bestRank) {
      bestRank = rank;
      best = normalizeSeverity(s);
    }
  }
  return best;
};

const linkReportToCluster = async (report, cluster) => {
  await EmergencyReport.updateOne(
    { _id: report._id },
    { $set: { clusterId: cluster._id } }
  );
  report.clusterId = cluster._id;
};

/**
 * Core clustering: attach a newly uploaded report to an existing cluster
 * or create a new one, then recompute confidence + severity.
 */
export const processReportForClustering = async (report) => {
  if (!report?._id || !report.location?.coordinates) {
    throw new Error('Invalid report for clustering');
  }

  // Already linked (e.g. retry) — idempotent no-op
  if (report.clusterId) {
    return EmergencyCluster.findById(report.clusterId);
  }

  const match = await findMatchingCluster(report);

  if (match) {
    const cluster = await EmergencyCluster.findById(match._id);
    if (!cluster) {
      // Rare race — fall through to create
    } else {
      const distMeters = match.distMeters ?? 0;
      const nextCount = cluster.reportCount + 1;
      const prevSeverity = cluster.severity;
      const prevCount = cluster.reportCount;

      const siblingSeverities = await EmergencyReport.find({
        clusterId: cluster._id,
      }).distinct('severity');
      siblingSeverities.push(report.severity);
      const maxSenderSeverity = maxSeverityAmong(siblingSeverities);

      const confidenceScore = computeConfidenceScore({
        reportCount: nextCount,
        distMeters,
        radiusMeters: CLUSTER_RADIUS_METERS,
      });

      const severity = computeClusterSeverity({
        maxSenderSeverity,
        confidenceScore,
        reportCount: nextCount,
        emergencyType: cluster.emergencyType,
      });

      cluster.reportCount = nextCount;
      cluster.lastReportAt = new Date(
        Math.max(
          new Date(cluster.lastReportAt).getTime(),
          new Date(report.timestamp).getTime()
        )
      );
      cluster.confidenceScore = confidenceScore;
      cluster.severity = severity;
      await cluster.save();

      await linkReportToCluster(report, cluster);

      emitToAdmin(AdminSocketEvents.CLUSTER_UPDATED, {
        cluster: toClusterPayload(cluster),
        previous: { reportCount: prevCount, severity: prevSeverity },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[clustering] joined ${report.messageId} → ${cluster.clusterId} (count=${cluster.reportCount})`
        );
      }
      return cluster;
    }
  }

  const confidenceScore = computeConfidenceScore({
    reportCount: 1,
    distMeters: 0,
    radiusMeters: CLUSTER_RADIUS_METERS,
  });
  const severity = computeClusterSeverity({
    maxSenderSeverity: report.severity,
    confidenceScore,
    reportCount: 1,
    emergencyType: report.emergencyType,
  });

  const cluster = await createClusterWithUniqueId({
    emergencyType: report.emergencyType,
    location: {
      type: 'Point',
      coordinates: [...report.location.coordinates],
    },
    severity,
    reportCount: 1,
    confidenceScore,
    firstReportAt: report.timestamp,
    lastReportAt: report.timestamp,
    status: 'unverified',
  });

  await linkReportToCluster(report, cluster);

  emitToAdmin(AdminSocketEvents.CLUSTER_CREATED, {
    cluster: toClusterPayload(cluster),
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[clustering] created ${cluster.clusterId} for ${report.messageId}`
    );
  }

  return cluster;
};

/** In-process enqueue — awaited by the upload path for reliable linking. */
export const enqueueForClustering = async (report) =>
  processReportForClustering(report);

export const listActiveClusters = async ({
  emergencyType,
  limit = 50,
  includeResolved = false,
} = {}) => {
  const filter = {
    status: includeResolved
      ? { $in: ['unverified', 'verified', 'resolved'] }
      : { $in: ['unverified', 'verified'] },
  };
  if (emergencyType) {
    filter.emergencyType = emergencyType;
  }

  const clusters = await EmergencyCluster.find(filter)
    .sort({ lastReportAt: -1 })
    .limit(Math.min(Number(limit) || 50, 200))
    .lean();

  return clusters.map((c) => ({
    id: String(c._id),
    clusterId: c.clusterId,
    emergencyType: c.emergencyType,
    location: c.location,
    severity: c.severity,
    reportCount: c.reportCount,
    confidenceScore: c.confidenceScore,
    firstReportAt: c.firstReportAt,
    lastReportAt: c.lastReportAt,
    status: c.status,
  }));
};
