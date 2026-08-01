import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { touchPresence } from '../middleware/touchPresence.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { emergencyUploadBodySchema } from '../validators/emergencyUpload.validators.js';
import { uploadEmergency } from '../controllers/emergencyUpload.controller.js';

const router = Router();

router.post(
  '/upload',
  authenticate,
  touchPresence,
  validateRequest({ body: emergencyUploadBodySchema }),
  uploadEmergency
);

export default router;
