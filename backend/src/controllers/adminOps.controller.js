import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  blockUser,
  unblockUser,
  verifyCluster,
  mergeClusters,
  deleteClusters,
  listReports,
  exportReports,
  deleteEmergencyReport,
  deleteEmergencyReports,
  listAuditLogs,
  listDevices,
  listUsers,
  getDashboardSummary as fetchDashboardSummary,
  getAnalytics as fetchAnalytics,
} from '../services/adminOpsService.js';

export const postBlockUser = asyncHandler(async (req, res) => {
  const result = await blockUser(req.body);
  req.auditTarget = {
    targetType: 'User',
    targetId: req.body.userId,
    metadata: { reason: req.body.reason || null },
  };
  return ApiResponse.success(res, result, 'User blocked');
});

export const postUnblockUser = asyncHandler(async (req, res) => {
  const result = await unblockUser(req.body);
  req.auditTarget = {
    targetType: 'User',
    targetId: req.body.userId,
  };
  return ApiResponse.success(res, result, 'User unblocked');
});

export const postVerifyCluster = asyncHandler(async (req, res) => {
  const result = await verifyCluster(req.body);
  req.auditTarget = {
    targetType: 'EmergencyCluster',
    targetId: result.cluster.clusterId,
  };
  return ApiResponse.success(res, result, 'Cluster verified');
});

export const postMergeClusters = asyncHandler(async (req, res) => {
  const result = await mergeClusters(req.body);
  req.auditTarget = {
    targetType: 'EmergencyCluster',
    targetId: result.cluster.clusterId,
    metadata: {
      sourceClusterId: req.body.sourceClusterId,
      targetClusterId: req.body.targetClusterId,
      clusterIds: req.body.clusterIds,
      mergedAwayClusterId: result.mergedAwayClusterId,
      mergedAwayClusterIds: result.mergedAwayClusterIds,
    },
  };
  return ApiResponse.success(res, result, 'Clusters merged');
});

export const postDeleteClusters = asyncHandler(async (req, res) => {
  const result = await deleteClusters(req.body);
  req.auditTarget = {
    targetType: 'EmergencyCluster',
    targetId: result.deleted?.[0]?.clusterId,
    metadata: {
      clusterIds: result.deleted?.map((row) => row.clusterId),
      count: result.deleted?.length || 0,
    },
  };
  return ApiResponse.success(res, result, 'Clusters deleted');
});

export const getReports = asyncHandler(async (req, res) => {
  const result = await listReports(req.query);
  return ApiResponse.success(res, result, 'OK');
});

export const getReportsExport = asyncHandler(async (req, res) => {
  const result = await exportReports(req.query);
  if (result.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="emergency-reports.csv"'
    );
    // Audit not required (read). Mark success for any wrappers watching status.
    return res.status(200).send(result.content);
  }
  return ApiResponse.success(res, { reports: result.reports }, 'OK');
});

export const deleteReport = asyncHandler(async (req, res) => {
  const result = await deleteEmergencyReport(req.params.reportId);
  req.auditTarget = {
    targetType: 'EmergencyReport',
    targetId: result.reportId,
    metadata: {
      messageId: result.messageId,
      clusterId: result.clusterId,
      clusterDeleted: result.clusterDeleted,
    },
  };
  return ApiResponse.success(res, result, 'Report deleted');
});

export const postDeleteReports = asyncHandler(async (req, res) => {
  const result = await deleteEmergencyReports(req.body);
  req.auditTarget = {
    targetType: 'EmergencyReport',
    targetId: result.deleted?.[0]?.reportId,
    metadata: {
      messageIds: result.deleted?.map((row) => row.messageId),
      count: result.deleted?.length || 0,
    },
  };
  return ApiResponse.success(res, result, 'Reports deleted');
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const result = await listAuditLogs(req.query);
  return ApiResponse.success(res, result, 'OK');
});

export const getDevices = asyncHandler(async (req, res) => {
  const result = await listDevices(req.query);
  return ApiResponse.success(res, result, 'OK');
});

export const getUsers = asyncHandler(async (req, res) => {
  const result = await listUsers(req.query);
  return ApiResponse.success(res, result, 'OK');
});

export const getDashboardSummary = asyncHandler(async (_req, res) => {
  const result = await fetchDashboardSummary();
  return ApiResponse.success(res, result, 'OK');
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const result = await fetchAnalytics({ days: req.query.days });
  return ApiResponse.success(res, result, 'OK');
});
