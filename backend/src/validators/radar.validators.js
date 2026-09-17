import { z } from 'zod';

const finiteNumber = (min, max) =>
  z.coerce.number().refine((n) => Number.isFinite(n) && n >= min && n <= max, {
    message: `must be a finite number between ${min} and ${max}`,
  });

const connectionStateSchema = z.enum([
  'CONNECTED',
  'DISCOVERED',
  'DISCONNECTED',
]);

const geoPointSchema = z.object({
  type: z.literal('Point').optional().default('Point'),
  coordinates: z
    .array(z.coerce.number())
    .length(2)
    .refine(
      ([lng, lat]) =>
        Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        lng >= -180 &&
        lng <= 180 &&
        lat >= -90 &&
        lat <= 90,
      { message: 'coordinates must be [longitude, latitude]' }
    ),
});

const radarPeerSchema = z.object({
  peerId: z.string().min(1).max(128),
  emergencyId: z.string().max(32).nullish(),
  displayName: z.string().min(1).max(80),
  connectionState: connectionStateSchema,
  distanceMeters: finiteNumber(0, 200),
  beyondRadarRange: z.boolean().optional().default(false),
  angleDegrees: finiteNumber(-180, 180),
  lastSeen: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.union([z.string().datetime(), z.coerce.date()]).optional()
  ),
  location: geoPointSchema.nullish(),
  locationSource: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    z.enum(['GPS', 'ESTIMATED']).optional()
  ),
});

export const radarSnapshotBodySchema = z.object({
  observerId: z.string().min(1).max(64).optional(),
  capturedAt: z.union([z.string().datetime(), z.coerce.date()]),
  sequence: z.coerce.number().int().nonnegative(),
  radarRangeMeters: finiteNumber(5, 80).optional().default(20),
  angleKind: z.enum(['VISUAL_SECTOR', 'COMPASS']).optional().default('VISUAL_SECTOR'),
  peers: z.array(radarPeerSchema).max(40),
  observerLocation: geoPointSchema.nullish(),
  observerAccuracyMeters: z.preprocess(
    (value) => (value === null || value === '' ? undefined : value),
    finiteNumber(0, 10_000).optional()
  ),
});

export const radarGatewayIdParamsSchema = z.object({
  userId: z.string().min(1).max(64),
});
