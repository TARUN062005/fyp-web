import { Router } from 'express';

const router = Router();

// Feature API routes will be mounted here.
router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'DTNEmergency API',
  });
});

export default router;
