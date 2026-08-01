import { Router } from 'express';
import { z } from 'zod';
import { authenticateAny } from '../middleware/authenticateAny.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { getClusters } from '../controllers/cluster.controller.js';
import {
  EMERGENCY_TYPE_VALUES,
  normalizeEmergencyType,
} from '../config/emergencyEnums.js';

const boolQuery = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    return v === true || v === 'true';
  });

const listClustersQuerySchema = z.object({
  emergencyType: z.preprocess(
    (v) =>
      v === undefined || v === null || v === ''
        ? undefined
        : normalizeEmergencyType(v),
    z.enum(EMERGENCY_TYPE_VALUES).optional()
  ),
  limit: z.coerce.number().int().positive().max(200).optional(),
  includeResolved: boolQuery,
});

const router = Router();

router.get(
  '/',
  authenticateAny,
  validateRequest({ query: listClustersQuerySchema }),
  getClusters
);

export default router;
