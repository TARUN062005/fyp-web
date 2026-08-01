import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { uploadEmergencyReport } from '../services/emergencyUploadService.js';

export const uploadEmergency = asyncHandler(async (req, res) => {
  const result = await uploadEmergencyReport(req.body, req.user.userId);
  const statusCode = result.created ? 201 : 200;
  const message = result.deduplicated
    ? 'Report already exists (idempotent)'
    : 'Report uploaded';
  return ApiResponse.success(res, result, message, statusCode);
});
