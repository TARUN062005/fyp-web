import { z } from 'zod';
import {
  EMERGENCY_TYPE_VALUES,
  SEVERITY_VALUES,
  normalizeEmergencyType,
  normalizeSeverity,
} from '../config/emergencyEnums.js';

const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    return v === true || v === 'true';
  });

const optionalSeverity = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? undefined : normalizeSeverity(v)),
  z.enum(SEVERITY_VALUES).optional()
);

const optionalEmergencyType = z.preprocess(
  (v) =>
    v === undefined || v === null || v === ''
      ? undefined
      : normalizeEmergencyType(v),
  z.enum(EMERGENCY_TYPE_VALUES).optional()
);

export const blockUserBodySchema = z.object({
  userId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export const unblockUserBodySchema = z.object({
  userId: z.string().min(1),
});

export const verifyClusterBodySchema = z.object({
  clusterId: z.string().min(1),
});

export const mergeClustersBodySchema = z.object({
  sourceClusterId: z.string().min(1),
  targetClusterId: z.string().min(1),
});

export const reportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  severity: optionalSeverity,
  emergencyType: optionalEmergencyType,
  /** Mongo id or public CLUSTER-XXXXXXXX */
  clusterId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minLng: z.coerce.number().optional(),
  minLat: z.coerce.number().optional(),
  maxLng: z.coerce.number().optional(),
  maxLat: z.coerce.number().optional(),
  format: z.enum(['json', 'csv']).optional(),
});

export const auditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  adminId: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
});

export const devicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['active', 'inactive', 'revoked']).optional(),
  /** Presence filter derived from lastSeenAt vs DEVICE_ONLINE_WINDOW_MS. */
  online: boolQuery,
  userId: z.string().min(1).optional(),
  sort: z.enum(['lastSeenAt', '-lastSeenAt', 'appVersion', '-appVersion']).optional(),
});

export const usersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  isVerified: boolQuery,
  isBlocked: boolQuery,
  /** Search Emergency ID or display name (case-insensitive substring). */
  q: z.string().trim().min(1).max(80).optional(),
});

export const analyticsQuerySchema = z.object({
  /** Lookback window in days for time-series series (1–90). */
  days: z.coerce.number().int().min(1).max(90).optional(),
});
