import mongoose from 'mongoose';
import User from '../models/User.js';
import Device from '../models/Device.js';
import EmergencyReport from '../models/EmergencyReport.js';
import EmergencyCluster from '../models/EmergencyCluster.js';
import AuditLog from '../models/AuditLog.js';
import AdminUser from '../models/AdminUser.js';
import { AppError } from '../utils/asyncHandler.js';
import {
  computeConfidenceScore,
  computeClusterSeverity,
  severityRank,
  normalizeSeverity,
} from './clusteringService.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';
import { DEVICE_ONLINE_MS } from './devicePresenceService.js';
import { toEmergencyReportDto } from './emergencyReportDto.js';

const toObjectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`${field} must be a valid id`, 400);
  }
  return new mongoose.Types.ObjectId(value);
};

const findClusterByKey = async (clusterKey) => {
  if (!clusterKey) throw new AppError('clusterId is required', 400);

  if (mongoose.Types.ObjectId.isValid(clusterKey)) {
    const byId = await EmergencyCluster.findById(clusterKey);
    if (byId) return byId;
  }

  const byPublicId = await EmergencyCluster.findOne({
    clusterId: String(clusterKey).toUpperCase(),
  });
  if (!byPublicId) {
    throw new AppError('Cluster not found', 404);
  }
  return byPublicId;
};

const publicUser = (user) => ({
  id: String(user._id),
  emergencyId: user.emergencyId,
  displayName: user.displayName,
  phoneNumber: user.phoneNumber ?? null,
  emergencyContact: user.emergencyContact?.phoneNumber ?? null,
  emergencyContactDetail: user.emergencyContact ?? null,
  isVerified: user.isVerified,
  isBlocked: user.isBlocked,
  lastSeenAt: user.lastSeenAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt ?? null,
  publicKeyFingerprint: user.publicKeyFingerprint,
});

export const blockUser = async ({ userId, reason }) => {
  const user = await User.findById(toObjectId(userId, 'userId'));
  if (!user) throw new AppError('User not found', 404);

  user.isBlocked = true;
  await user.save();

  const payload = {
    user: publicUser(user),
    reason: reason || null,
  };
  emitToAdmin(AdminSocketEvents.USER_BLOCKED, payload);
  return payload;
};

export const unblockUser = async ({ userId }) => {
  const user = await User.findById(toObjectId(userId, 'userId'));
  if (!user) throw new AppError('User not found', 404);

  user.isBlocked = false;
  await user.save();

  const payload = { user: publicUser(user) };
  emitToAdmin(AdminSocketEvents.USER_UNBLOCKED, payload);
  return payload;
};

export const verifyCluster = async ({ clusterId }) => {
  const cluster = await findClusterByKey(clusterId);
  cluster.status = 'verified';
  await cluster.save();

  const payload = {
    cluster: {
      id: String(cluster._id),
      clusterId: cluster.clusterId,
      status: cluster.status,
      severity: cluster.severity,
      reportCount: cluster.reportCount,
      emergencyType: cluster.emergencyType,
    },
  };
  emitToAdmin(AdminSocketEvents.CLUSTER_VERIFIED, payload);
  return payload;
};

export const mergeClusters = async ({ sourceClusterId, targetClusterId }) => {
  if (String(sourceClusterId) === String(targetClusterId)) {
    throw new AppError('source and target cluster IDs must differ', 400);
  }

  const source = await findClusterByKey(sourceClusterId);
  const target = await findClusterByKey(targetClusterId);

  if (source.emergencyType !== target.emergencyType) {
    throw new AppError(
      'Cannot merge clusters with different emergencyType',
      400
    );
  }

  // Sequential updates (no multi-doc transaction) — fine for single-instance Mongo.
  await EmergencyReport.updateMany(
    { clusterId: source._id },
    { $set: { clusterId: target._id } }
  );

  const reports = await EmergencyReport.find({ clusterId: target._id })
    .select('severity')
    .lean();

  const reportCount = reports.length;
  const maxSenderSeverity = reports.reduce((best, r) => {
    return severityRank(r.severity) > severityRank(best)
      ? normalizeSeverity(r.severity)
      : best;
  }, 'LOW');

  const confidenceScore = computeConfidenceScore({
    reportCount: Math.max(reportCount, 1),
    distMeters: 0,
  });
  const severity = computeClusterSeverity({
    maxSenderSeverity,
    confidenceScore,
    reportCount: Math.max(reportCount, 1),
    emergencyType: target.emergencyType,
  });

  target.reportCount = reportCount;
  target.firstReportAt = new Date(
    Math.min(
      new Date(target.firstReportAt).getTime(),
      new Date(source.firstReportAt).getTime()
    )
  );
  target.lastReportAt = new Date(
    Math.max(
      new Date(target.lastReportAt).getTime(),
      new Date(source.lastReportAt).getTime()
    )
  );
  target.confidenceScore = confidenceScore;
  target.severity = severity;
  if (source.status === 'verified' || target.status === 'verified') {
    target.status = 'verified';
  }
  await target.save();
  await EmergencyCluster.deleteOne({ _id: source._id });

  const merged = await EmergencyCluster.findById(target._id);
  const payload = {
    cluster: {
      id: String(merged._id),
      clusterId: merged.clusterId,
      emergencyType: merged.emergencyType,
      severity: merged.severity,
      reportCount: merged.reportCount,
      confidenceScore: merged.confidenceScore,
      firstReportAt: merged.firstReportAt,
      lastReportAt: merged.lastReportAt,
      status: merged.status,
      location: merged.location,
    },
    mergedAwayClusterId: source.clusterId,
  };
  emitToAdmin(AdminSocketEvents.CLUSTER_MERGED, payload);
  return payload;
};

const buildReportFilter = async ({
  severity,
  from,
  to,
  minLng,
  minLat,
  maxLng,
  maxLat,
  emergencyType,
  clusterId,
}) => {
  const filter = {};

  if (severity) filter.severity = new RegExp(`^${severity}$`, 'i');
  if (emergencyType) filter.emergencyType = emergencyType;

  if (clusterId) {
    const cluster = await findClusterByKey(clusterId);
    filter.clusterId = cluster._id;
  }

  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }

  const hasBox =
    minLng !== undefined &&
    minLat !== undefined &&
    maxLng !== undefined &&
    maxLat !== undefined;

  if (hasBox) {
    filter.location = {
      $geoWithin: {
        $box: [
          [Number(minLng), Number(minLat)],
          [Number(maxLng), Number(maxLat)],
        ],
      },
    };
  }

  return filter;
};

const toReportDto = (report) => toEmergencyReportDto(report);

export const listReports = async (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter = await buildReportFilter(query);

  const [total, rows] = await Promise.all([
    EmergencyReport.countDocuments(filter),
    EmergencyReport.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    reports: rows.map(toReportDto),
  };
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportReports = async (query) => {
  const format = (query.format || 'json').toLowerCase();
  const filter = await buildReportFilter(query);
  const rows = await EmergencyReport.find(filter)
    .sort({ timestamp: -1 })
    .limit(5000)
    .lean();

  const reports = rows.map(toReportDto);

  if (format === 'csv') {
    const headers = [
      'id',
      'messageId',
      'originalSenderId',
      'uploaderId',
      'uploadCount',
      'relayCount',
      'hopCount',
      'verificationStatus',
      'confidenceScore',
      'trueVotes',
      'falseVotes',
      'unknownVotes',
      'emergencyType',
      'severity',
      'lng',
      'lat',
      'timestamp',
      'clusterId',
      'createdAt',
    ];
    const lines = [headers.join(',')];
    for (const r of reports) {
      lines.push(
        [
          r.id,
          r.messageId,
          r.originalSenderId,
          r.uploaderId,
          r.uploadCount,
          r.relayCount,
          r.hopCount,
          r.verificationStatus,
          r.confidenceScore,
          r.trueVotes,
          r.falseVotes,
          r.unknownVotes,
          r.emergencyType,
          r.severity,
          r.location?.coordinates?.[0],
          r.location?.coordinates?.[1],
          r.timestamp?.toISOString?.() || r.timestamp,
          r.clusterId,
          r.createdAt?.toISOString?.() || r.createdAt,
        ]
          .map(escapeCsv)
          .join(',')
      );
    }
    return { format: 'csv', content: `${lines.join('\n')}\n`, reports };
  }

  return { format: 'json', reports };
};

export const listAuditLogs = async (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter = {};

  if (query.adminId) {
    filter.adminId = toObjectId(query.adminId, 'adminId');
  }
  if (query.action) {
    filter.action = query.action;
  }

  const [total, rows, actionTypes, adminIdDistinct] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.distinct('action'),
    AuditLog.distinct('adminId'),
  ]);

  const admins = await AdminUser.find({ _id: { $in: adminIdDistinct } })
    .select('email role')
    .lean();
  const adminById = Object.fromEntries(
    admins.map((a) => [String(a._id), a])
  );

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    logs: rows.map((log) => {
      const admin = adminById[String(log.adminId)];
      return {
        id: String(log._id),
        adminId: String(log.adminId),
        adminEmail: admin?.email || null,
        adminRole: admin?.role || null,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        timestamp: log.timestamp,
        metadata: log.metadata ?? null,
      };
    }),
    filterOptions: {
      actions: actionTypes.sort(),
      admins: admins
        .map((a) => ({
          id: String(a._id),
          email: a.email,
          role: a.role,
        }))
        .sort((a, b) => a.email.localeCompare(b.email)),
    },
  };
};

export const listDevices = async (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const onlineCutoff = new Date(Date.now() - DEVICE_ONLINE_MS);
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.userId) filter.userId = toObjectId(query.userId, 'userId');

  // Presence = active lifecycle + lastSeenAt within DEVICE_ONLINE_WINDOW_MS
  if (query.online === true || query.online === 'true') {
    filter.status = 'active';
    filter.lastSeenAt = { $gte: onlineCutoff };
  } else if (query.online === false || query.online === 'false') {
    filter.$or = [
      { status: { $ne: 'active' } },
      { lastSeenAt: null },
      { lastSeenAt: { $lt: onlineCutoff } },
    ];
    // If a lifecycle status was also requested, keep it
    if (query.status) {
      filter.status = query.status;
      if (query.status === 'active') {
        filter.$or = [{ lastSeenAt: null }, { lastSeenAt: { $lt: onlineCutoff } }];
      } else {
        delete filter.$or;
      }
    }
  }

  const sortKey = String(query.sort || '-lastSeenAt');
  const sort = sortKey.startsWith('-')
    ? { [sortKey.slice(1)]: -1 }
    : { [sortKey]: 1 };
  if (!sort.lastSeenAt && !sort.appVersion) {
    sort.lastSeenAt = -1;
  }

  const [total, rows] = await Promise.all([
    Device.countDocuments(filter),
    Device.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    onlineWindowMs: DEVICE_ONLINE_MS,
    onlineWindowMinutes: DEVICE_ONLINE_MS / 60_000,
    onlineCutoff: onlineCutoff.toISOString(),
    devices: rows.map((d) => ({
      id: String(d._id),
      userId: String(d.userId),
      deviceId: d.deviceId,
      appVersion: d.appVersion,
      status: d.status,
      lastSeenAt: d.lastSeenAt,
      online: Boolean(
        d.status === 'active' &&
          d.lastSeenAt &&
          new Date(d.lastSeenAt).getTime() >= onlineCutoff.getTime()
      ),
      createdAt: d.createdAt,
    })),
  };
};

export const listUsers = async (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter = {};

  if (query.isVerified !== undefined) {
    filter.isVerified =
      query.isVerified === true || query.isVerified === 'true';
  }
  if (query.isBlocked !== undefined) {
    filter.isBlocked = query.isBlocked === true || query.isBlocked === 'true';
  }

  const q = String(query.q || '').trim();
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'i');
    filter.$or = [{ emergencyId: re }, { displayName: re }];
  }

  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    users: rows.map(publicUser),
  };
};

/**
 * Server-side aggregates for the read-only analytics page.
 * B9 list/export endpoints are paginated row dumps — not suitable for
 * client-side time-series derivation.
 */
export const getAnalytics = async ({ days = 14 } = {}) => {
  const windowDays = Math.min(90, Math.max(1, Number(days) || 14));
  // UTC day buckets — matches Mongo $dateToString default (UTC)
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (windowDays - 1));

  const dayKey = {
    $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'UTC' },
  };
  const clusterDayKey = {
    $dateToString: {
      format: '%Y-%m-%d',
      date: '$firstReportAt',
      timezone: 'UTC',
    },
  };

  const [reportVolumeRaw, severityRaw, clusterGrowthRaw] = await Promise.all([
    EmergencyReport.aggregate([
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: dayKey, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    EmergencyReport.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            $toUpper: { $ifNull: ['$severity', 'UNKNOWN'] },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    EmergencyCluster.aggregate([
      { $match: { firstReportAt: { $gte: since } } },
      { $group: { _id: clusterDayKey, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Fill every UTC day in the window so charts stay continuous
  const dayLabels = [];
  for (let i = 0; i < windowDays; i += 1) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    dayLabels.push(d.toISOString().slice(0, 10));
  }

  const volumeMap = Object.fromEntries(
    reportVolumeRaw.map((r) => [r._id, r.count])
  );
  const clusterMap = Object.fromEntries(
    clusterGrowthRaw.map((r) => [r._id, r.count])
  );

  let clusterCumulative = 0;
  const reportVolumeOverTime = dayLabels.map((date) => ({
    date,
    count: volumeMap[date] || 0,
  }));
  const clusterGrowthOverTime = dayLabels.map((date) => {
    const created = clusterMap[date] || 0;
    clusterCumulative += created;
    return { date, created, cumulative: clusterCumulative };
  });

  const severityOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const severityMap = Object.fromEntries(
    severityRaw.map((r) => [String(r._id).toUpperCase(), r.count])
  );
  const severityDistribution = severityOrder.map((severity) => ({
    severity,
    count: severityMap[severity] || 0,
  }));
  // Include any unexpected labels after the canonical set
  for (const [severity, count] of Object.entries(severityMap)) {
    if (!severityOrder.includes(severity)) {
      severityDistribution.push({ severity, count });
    }
  }

  return {
    days: windowDays,
    since: since.toISOString(),
    generatedAt: new Date().toISOString(),
    reportVolumeOverTime,
    severityDistribution,
    clusterGrowthOverTime,
  };
};

export const getDashboardSummary = async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const onlineCutoff = new Date(Date.now() - DEVICE_ONLINE_MS);

  const [
    activeEmergencies,
    clustersToday,
    verifiedUsers,
    blockedUsers,
    devicesOnline,
  ] = await Promise.all([
    EmergencyCluster.countDocuments({
      status: { $in: ['unverified', 'verified'] },
    }),
    EmergencyCluster.countDocuments({
      status: { $in: ['unverified', 'verified'] },
      lastReportAt: { $gte: startOfToday },
    }),
    User.countDocuments({ isVerified: true }),
    User.countDocuments({ isBlocked: true }),
    Device.countDocuments({
      status: 'active',
      lastSeenAt: { $gte: onlineCutoff },
    }),
  ]);

  return {
    activeEmergencies,
    clustersToday,
    verifiedUsers,
    blockedUsers,
    devicesOnline,
    generatedAt: new Date().toISOString(),
  };
};
