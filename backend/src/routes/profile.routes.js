import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { touchPresence } from '../middleware/touchPresence.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { patchProfileBodySchema } from '../validators/profile.validators.js';
import {
  getProfile,
  getCertificate,
  patchProfile,
} from '../controllers/profile.controller.js';

const router = Router();

router.get('/', authenticate, touchPresence, getProfile);
router.patch(
  '/',
  authenticate,
  touchPresence,
  validateRequest({ body: patchProfileBodySchema }),
  patchProfile
);
router.get('/certificate', authenticate, touchPresence, getCertificate);

export default router;
