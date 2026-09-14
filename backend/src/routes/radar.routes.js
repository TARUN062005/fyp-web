import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { touchPresence } from '../middleware/touchPresence.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { radarSnapshotBodySchema } from '../validators/radar.validators.js';
import { postRadarSnapshot } from '../controllers/radar.controller.js';

const router = Router();

router.post(
  '/snapshot',
  authenticate,
  touchPresence,
  validateRequest({ body: radarSnapshotBodySchema }),
  postRadarSnapshot
);

export default router;
