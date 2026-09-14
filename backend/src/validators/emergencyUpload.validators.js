import { z } from 'zod';
import {
  EMERGENCY_TYPE_VALUES,
  SEVERITY_VALUES,
  normalizeEmergencyType,
  normalizeSeverity,
} from '../config/emergencyEnums.js';

const geoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z
    .tuple([z.number(), z.number()])
    .refine(
      ([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
      'coordinates must be [lng, lat] within valid ranges'
    ),
});

const severitySchema = z.preprocess(
  (v) => (v === undefined || v === null ? v : normalizeSeverity(v)),
  z.enum(SEVERITY_VALUES, {
    errorMap: () => ({
      message: `severity must be one of: ${SEVERITY_VALUES.join(', ')}`,
    }),
  })
);

const emergencyTypeSchema = z.preprocess(
  (v) => (v === undefined || v === null ? v : normalizeEmergencyType(v)),
  z.enum(EMERGENCY_TYPE_VALUES, {
    errorMap: () => ({
      message: `emergencyType must be one of: ${EMERGENCY_TYPE_VALUES.join(', ')}`,
    }),
  })
);

const MAX_TTL_MS = 48 * 60 * 60 * 1000;

export const emergencyUploadBodySchema = z.object({
  messageId: z.string().min(1).max(128),
  originalSenderId: z.string().min(1).max(64).nullish(),
  uploaderId: z.string().min(1),
  emergencyType: emergencyTypeSchema,
  severity: severitySchema,
  location: geoPointSchema,
  timestamp: z.union([z.string().min(1), z.coerce.date()]),
  hopCount: z.coerce.number().int().min(0).max(5).optional().default(0),
  senderId: z.string().min(1).max(128),
  createdAtMs: z.coerce.number().int(),
  ttl: z.coerce.number().int().positive().max(MAX_TTL_MS),
  radiusCanonical: z.string().min(1).max(32),
  latitudeCanonical: z.string().min(1).max(32),
  longitudeCanonical: z.string().min(1).max(32),
  batteryPercentage: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.number().int().min(0).max(100).optional()
  ),
  senderPublicKey: z.string().min(1).max(128),
  signature: z.string().min(1).max(256),
});
