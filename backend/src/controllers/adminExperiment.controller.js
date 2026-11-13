import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  listExperimentsForAdmin,
  loadExperimentBundle,
  paginateTrials,
} from '../services/experimentService.js';
import {
  buildExperimentPdfBuffer,
  experimentReportFilename,
} from '../services/experimentReportPdf.js';

export const adminListExperiments = asyncHandler(async (req, res) => {
  const result = await listExperimentsForAdmin(req.query);
  return ApiResponse.success(res, result, 'Experiments');
});

export const adminGetExperiment = asyncHandler(async (req, res) => {
  const bundle = await loadExperimentBundle(req.params.experimentId);
  return ApiResponse.success(
    res,
    {
      experiment: bundle.experiment,
      devices: bundle.devices,
      summary: bundle.summary,
      byScenario: bundle.byScenario,
      audits: bundle.audits,
      measurementKind: 'PHYSICAL_ANDROID',
    },
    'Experiment detail'
  );
});

export const adminGetExperimentTrials = asyncHandler(async (req, res) => {
  const bundle = await loadExperimentBundle(req.params.experimentId);
  const page = paginateTrials(bundle.trials, req.query);
  return ApiResponse.success(res, page, 'Experiment trials');
});

export const adminGetExperimentEvents = asyncHandler(async (req, res) => {
  const bundle = await loadExperimentBundle(req.params.experimentId);
  const page = Number(req.query.page || 1);
  const limit = Math.min(200, Number(req.query.limit || 100));
  const start = (page - 1) * limit;
  return ApiResponse.success(
    res,
    {
      items: bundle.events.slice(start, start + limit),
      total: bundle.events.length,
      page,
      limit,
    },
    'Experiment events'
  );
});

export const adminGetExperimentReport = asyncHandler(async (req, res) => {
  const bundle = await loadExperimentBundle(req.params.experimentId);
  const pdf = await buildExperimentPdfBuffer(bundle);
  const filename = experimentReportFilename();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(pdf);
});
