import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  createExperiment,
  joinExperimentByCode,
  listExperimentsForUser,
  getExperimentForUser,
  updateExperimentStatus,
  registerDevice,
  ingestEventBatch,
  loadExperimentBundle,
  paginateTrials,
} from '../services/experimentService.js';

export const postExperiment = asyncHandler(async (req, res) => {
  const created = await createExperiment(req.user.userId, req.body);
  return ApiResponse.success(res, created, 'Experiment created', 201);
});

export const postJoinExperiment = asyncHandler(async (req, res) => {
  const experiment = await joinExperimentByCode(req.user.userId, req.body.joinCode);
  return ApiResponse.success(res, experiment, 'Experiment found');
});

export const getExperiments = asyncHandler(async (req, res) => {
  const result = await listExperimentsForUser(req.user.userId, req.query);
  return ApiResponse.success(res, result, 'Experiments');
});

export const getExperiment = asyncHandler(async (req, res) => {
  const experiment = await getExperimentForUser(
    req.user.userId,
    req.params.experimentId
  );
  return ApiResponse.success(res, experiment, 'Experiment');
});

export const patchExperimentStatus = asyncHandler(async (req, res) => {
  const experiment = await updateExperimentStatus(
    req.user.userId,
    req.params.experimentId,
    req.body.status
  );
  return ApiResponse.success(res, experiment, 'Experiment status updated');
});

export const postExperimentDevice = asyncHandler(async (req, res) => {
  const device = await registerDevice(
    req.user.userId,
    req.params.experimentId,
    req.body
  );
  return ApiResponse.success(res, device, 'Device registered', 201);
});

export const postExperimentEventsBatch = asyncHandler(async (req, res) => {
  const result = await ingestEventBatch(
    req.user.userId,
    req.params.experimentId,
    req.body
  );
  return ApiResponse.success(res, result, 'Events ingested');
});

export const getExperimentResults = asyncHandler(async (req, res) => {
  await getExperimentForUser(req.user.userId, req.params.experimentId);
  const bundle = await loadExperimentBundle(req.params.experimentId);
  return ApiResponse.success(
    res,
    {
      experiment: bundle.experiment,
      devices: bundle.devices,
      summary: bundle.summary,
      byScenario: bundle.byScenario,
      measurementKind: 'PHYSICAL_ANDROID',
    },
    'Experiment results'
  );
});

export const getExperimentTrials = asyncHandler(async (req, res) => {
  await getExperimentForUser(req.user.userId, req.params.experimentId);
  const bundle = await loadExperimentBundle(req.params.experimentId);
  const page = paginateTrials(bundle.trials, req.query);
  return ApiResponse.success(res, page, 'Experiment trials');
});
