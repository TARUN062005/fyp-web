import { Router } from 'express';
import {
  adminLogin,
  adminRefresh,
  adminLogout,
  adminMe,
} from '../controllers/adminAuth.controller.js';
import {
  postBlockUser,
  postUnblockUser,
  postVerifyCluster,
  postMergeClusters,
  getReports,
  getReportsExport,
  getAuditLogs,
  getDevices,
  getUsers,
  getDashboardSummary,
  getAnalytics,
} from '../controllers/adminOps.controller.js';
import { authenticateAdmin } from '../middleware/authenticateAdmin.js';
import { requireRole } from '../middleware/requireRole.js';
import { auditLog } from '../middleware/auditLog.js';
import { sensitiveRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  adminLoginBodySchema,
  adminRefreshBodySchema,
} from '../validators/auth.validators.js';
import {
  blockUserBodySchema,
  unblockUserBodySchema,
  verifyClusterBodySchema,
  mergeClustersBodySchema,
  reportsQuerySchema,
  auditLogsQuerySchema,
  devicesQuerySchema,
  usersQuerySchema,
  analyticsQuerySchema,
} from '../validators/adminOps.validators.js';

const router = Router();

router.post(
  '/auth/login',
  sensitiveRateLimiter,
  validateRequest({ body: adminLoginBodySchema }),
  adminLogin
);
router.post(
  '/auth/refresh',
  sensitiveRateLimiter,
  validateRequest({ body: adminRefreshBodySchema }),
  adminRefresh
);
router.post(
  '/auth/logout',
  validateRequest({ body: adminRefreshBodySchema }),
  adminLogout
);

router.get(
  '/me',
  authenticateAdmin,
  requireRole('admin', 'superadmin'),
  adminMe
);

const adminGuard = [authenticateAdmin, requireRole('admin', 'superadmin')];

router.post(
  '/block-user',
  ...adminGuard,
  validateRequest({ body: blockUserBodySchema }),
  auditLog('user.block', (req) => ({
    targetType: 'User',
    targetId: req.body.userId,
    metadata: { reason: req.body.reason || null },
  })),
  postBlockUser
);

router.post(
  '/unblock-user',
  ...adminGuard,
  validateRequest({ body: unblockUserBodySchema }),
  auditLog('user.unblock', (req) => ({
    targetType: 'User',
    targetId: req.body.userId,
  })),
  postUnblockUser
);

router.post(
  '/verify-cluster',
  ...adminGuard,
  validateRequest({ body: verifyClusterBodySchema }),
  auditLog('cluster.verify'),
  postVerifyCluster
);

router.post(
  '/merge-clusters',
  ...adminGuard,
  validateRequest({ body: mergeClustersBodySchema }),
  auditLog('cluster.merge'),
  postMergeClusters
);

router.get(
  '/reports',
  ...adminGuard,
  validateRequest({ query: reportsQuerySchema }),
  getReports
);

router.get(
  '/reports/export',
  ...adminGuard,
  validateRequest({ query: reportsQuerySchema }),
  getReportsExport
);

router.get(
  '/audit-logs',
  ...adminGuard,
  validateRequest({ query: auditLogsQuerySchema }),
  getAuditLogs
);

router.get(
  '/devices',
  ...adminGuard,
  validateRequest({ query: devicesQuerySchema }),
  getDevices
);

router.get(
  '/users',
  ...adminGuard,
  validateRequest({ query: usersQuerySchema }),
  getUsers
);

router.get('/dashboard-summary', ...adminGuard, getDashboardSummary);

router.get(
  '/analytics',
  ...adminGuard,
  validateRequest({ query: analyticsQuerySchema }),
  getAnalytics
);

export default router;
