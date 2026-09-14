import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  getAdminRadarGateway,
  listAdminRadarGateways,
  publishRadarSnapshot,
} from '../services/radarService.js';

export const postRadarSnapshot = asyncHandler(async (req, res) => {
  const result = await publishRadarSnapshot(req.body, req.user.userId);
  return ApiResponse.success(res, result, 'Radar snapshot accepted');
});

export const getRadarGateways = asyncHandler(async (_req, res) => {
  return ApiResponse.success(res, listAdminRadarGateways(), 'OK');
});

export const getRadarGatewayById = asyncHandler(async (req, res) => {
  const record = getAdminRadarGateway(req.params.userId);
  return ApiResponse.success(res, record, 'OK');
});
