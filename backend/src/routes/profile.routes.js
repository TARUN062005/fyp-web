import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { touchPresence } from '../middleware/touchPresence.js';
import { getProfile, getCertificate } from '../controllers/profile.controller.js';

const router = Router();

router.get('/', authenticate, touchPresence, getProfile);
router.get('/certificate', authenticate, touchPresence, getCertificate);

export default router;
