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

const radarPeerSchema = z.object({
  peerId: z.string().min(1).max(128),
  emergencyId: z.string().max(32).nullish(),
  displayName: z.string().min(1).max(80),
  connectionState: connectionStateSchema,
  distanceMeters: finiteNumber(0, 200),
  beyondRadarRange: z.boolean().optional().default(false),
  angleDegrees: finiteNumber(-180, 180),
  lastSeen: z.union([z.string().datetime(), z.coerce.date()]).optional(),
});

export const radarSnapshotBodySchema = z.object({
  observerId: z.string().min(1).max(64).optional(),
  capturedAt: z.union([z.string().datetime(), z.coerce.date()]),
  sequence: z.coerce.number().int().nonnegative(),
  radarRangeMeters: finiteNumber(5, 80).optional().default(20),
  angleKind: z.enum(['VISUAL_SECTOR', 'COMPASS']).optional().default('VISUAL_SECTOR'),
  peers: z.array(radarPeerSchema).max(40),
});

export const radarGatewayIdParamsSchema = z.object({
  userId: z.string().min(1).max(64),
});
