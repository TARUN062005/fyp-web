import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  createExperimentBodySchema,
  joinExperimentBodySchema,
  updateExperimentStatusBodySchema,
  registerDeviceBodySchema,
  batchEventsBodySchema,
  experimentIdParamsSchema,
  experimentListQuerySchema,
  trialListQuerySchema,
} from '../validators/experiment.validators.js';
import {
  postExperiment,
  postJoinExperiment,
  getExperiments,
  getExperiment,
  patchExperimentStatus,
  postExperimentDevice,
  postExperimentEventsBatch,
  getExperimentResults,
  getExperimentTrials,
} from '../controllers/experiment.controller.js';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  validateRequest({ body: createExperimentBodySchema }),
  postExperiment
);
router.post(
  '/join',
  validateRequest({ body: joinExperimentBodySchema }),
  postJoinExperiment
);
router.get(
  '/',
  validateRequest({ query: experimentListQuerySchema }),
  getExperiments
);
router.get(
  '/:experimentId',
  validateRequest({ params: experimentIdParamsSchema }),
  getExperiment
);
router.patch(
  '/:experimentId/status',
  validateRequest({
    params: experimentIdParamsSchema,
    body: updateExperimentStatusBodySchema,
  }),
  patchExperimentStatus
);
router.post(
  '/:experimentId/devices',
  validateRequest({
    params: experimentIdParamsSchema,
    body: registerDeviceBodySchema,
  }),
  postExperimentDevice
);
router.post(
  '/:experimentId/events/batch',
  validateRequest({
    params: experimentIdParamsSchema,
    body: batchEventsBodySchema,
  }),
  postExperimentEventsBatch
);
router.get(
  '/:experimentId/results',
  validateRequest({ params: experimentIdParamsSchema }),
  getExperimentResults
);
router.get(
  '/:experimentId/trials',
  validateRequest({
    params: experimentIdParamsSchema,
    query: trialListQuerySchema,
  }),
  getExperimentTrials
);

export default router;
