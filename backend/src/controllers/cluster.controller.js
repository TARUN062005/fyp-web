import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { listActiveClusters } from '../services/clusteringService.js';

export const getClusters = asyncHandler(async (req, res) => {
  const { emergencyType, limit, includeResolved } = req.query;
  const clusters = await listActiveClusters({
    emergencyType,
    limit,
    includeResolved: Boolean(includeResolved),
  });
  return ApiResponse.success(res, { clusters }, 'OK');
});
