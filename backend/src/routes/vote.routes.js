import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { touchPresence } from '../middleware/touchPresence.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  consensusQuerySchema,
  voteUploadBodySchema,
} from '../validators/vote.validators.js';
import {
  getConsensusUpdates,
  postVoteUpload,
} from '../controllers/vote.controller.js';

const router = Router();

router.post(
  '/upload',
  authenticate,
  touchPresence,
  validateRequest({ body: voteUploadBodySchema }),
  postVoteUpload
);

router.get(
  '/consensus',
  authenticate,
  touchPresence,
  validateRequest({ query: consensusQuerySchema }),
  getConsensusUpdates
);

export default router;
