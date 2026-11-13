import { z } from 'zod';
import {
  EXPERIMENT_EVENT_TYPES,
  EXPERIMENT_ROLES,
  EXPERIMENT_SCENARIOS,
  EXPERIMENT_STATUSES,
  FORBIDDEN_EVENT_KEYS,
} from '../config/experimentConstants.js';

const uuidLike = z.string().trim().min(8).max(80);

export const createExperimentBodySchema = z.object({
  experimentId: uuidLike,
  name: z.string().trim().min(1).max(200),
  scenario: z.enum(EXPERIMENT_SCENARIOS),
  participantCount: z.number().int().min(2).max(8),
  description: z.string().trim().max(2000).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  startedAt: z.number().int().positive().optional(),
  appVersion: z.string().trim().max(40).optional().default(''),
  joinCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : v)),
});

export const joinExperimentBodySchema = z.object({
  joinCode: z
    .string()
    .trim()
    .min(4)
    .max(12)
    .transform((v) => v.toUpperCase()),
});

export const updateExperimentStatusBodySchema = z.object({
  status: z.enum(EXPERIMENT_STATUSES),
});

export const registerDeviceBodySchema = z.object({
  deviceId: z.string().trim().min(1).max(120),
  meshUserId: z.string().trim().min(1).max(128),
  model: z.string().trim().max(80).optional().default(''),
  androidVersion: z.string().trim().max(40).optional().default(''),
  appVersion: z.string().trim().max(40).optional().default(''),
  role: z.enum(EXPERIMENT_ROLES),
  clockOffsetMs: z.number().finite().nullable().optional(),
  clockUncertaintyMs: z.number().finite().nonnegative().nullable().optional(),
});

const extraSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .transform((extra) => {
    if (!extra) return undefined;
    const cleaned = {};
    for (const [key, value] of Object.entries(extra)) {
      const lower = key.toLowerCase();
      if (FORBIDDEN_EVENT_KEYS.some((k) => lower.includes(k.toLowerCase()))) {
        continue;
      }
      if (typeof value === 'string' && value.length > 256) continue;
      cleaned[key] = value;
    }
    return Object.keys(cleaned).length ? cleaned : undefined;
  });

export const experimentEventSchema = z.object({
  eventId: uuidLike,
  trialId: uuidLike,
  messageId: z.string().trim().max(120).nullable().optional(),
  eventType: z.enum(EXPERIMENT_EVENT_TYPES),
  deviceId: z.string().trim().min(1).max(120),
  meshUserId: z.string().trim().max(128).optional().default(''),
  wallClockMs: z.number().int().positive(),
  elapsedRealtimeMs: z.number().finite().nullable().optional(),
  clockOffsetMs: z.number().finite().nullable().optional(),
  clockUncertaintyMs: z.number().finite().nonnegative().nullable().optional(),
  scenario: z.enum(EXPERIMENT_SCENARIOS),
  hopCount: z.number().int().min(0).max(64).nullable().optional(),
  maxHopCount: z.number().int().min(0).max(64).nullable().optional(),
  sourceDeviceId: z.string().trim().max(120).nullable().optional(),
  destinationDeviceId: z.string().trim().max(120).nullable().optional(),
  errorCode: z.string().trim().max(120).nullable().optional(),
  extra: extraSchema,
});

export const batchEventsBodySchema = z.object({
  deviceId: z.string().trim().min(1).max(120),
  events: z.array(experimentEventSchema).min(1).max(500),
});

export const experimentIdParamsSchema = z.object({
  experimentId: uuidLike,
});

export const experimentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
  scenario: z.enum(EXPERIMENT_SCENARIOS).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const trialListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  scenario: z.enum(EXPERIMENT_SCENARIOS).optional(),
  delivered: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  deviceId: z.string().trim().max(120).optional(),
});
