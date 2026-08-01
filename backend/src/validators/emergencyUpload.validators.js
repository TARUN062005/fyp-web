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

export const emergencyUploadBodySchema = z.object({
  messageId: z.string().min(1).max(128),
  originalSenderId: z.string().min(1),
  uploaderId: z.string().min(1),
  emergencyType: emergencyTypeSchema,
  severity: severitySchema,
  location: geoPointSchema,
  timestamp: z.union([z.string().datetime(), z.coerce.date()]),
});
