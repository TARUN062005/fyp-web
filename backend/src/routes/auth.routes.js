import { Router } from 'express';
import {
  googleAuth,
  refreshAuth,
  logoutAuth,
} from '../controllers/auth.controller.js';
import { sensitiveRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  googleAuthBodySchema,
  mobileRefreshBodySchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post(
  '/google',
  sensitiveRateLimiter,
  validateRequest({ body: googleAuthBodySchema }),
  googleAuth
);

router.post(
  '/refresh',
  sensitiveRateLimiter,
  validateRequest({ body: mobileRefreshBodySchema }),
  refreshAuth
);

router.post(
  '/logout',
  validateRequest({ body: mobileRefreshBodySchema }),
  logoutAuth
);

export default router;
