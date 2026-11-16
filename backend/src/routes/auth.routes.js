import { Router } from 'express';
import {
  googleAuth,
  refreshAuth,
  logoutAuth,
} from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  googleAuthBodySchema,
  mobileRefreshBodySchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post(
  '/google',
  validateRequest({ body: googleAuthBodySchema }),
  googleAuth
);

router.post(
  '/refresh',
  validateRequest({ body: mobileRefreshBodySchema }),
  refreshAuth
);

router.post(
  '/logout',
  validateRequest({ body: mobileRefreshBodySchema }),
  logoutAuth
);

export default router;
