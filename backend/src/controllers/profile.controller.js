import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  getProfileForUserId,
  getCertificateForUserId,
  updateProfileForUserId,
} from '../services/authService.js';

export const getProfile = asyncHandler(async (req, res) => {
  const profile = await getProfileForUserId(req.user.userId);
  return ApiResponse.success(res, profile, 'OK');
});

export const getCertificate = asyncHandler(async (req, res) => {
  const certificate = await getCertificateForUserId(req.user.userId);
  return ApiResponse.success(res, certificate, 'OK');
});

export const patchProfile = asyncHandler(async (req, res) => {
  const data = await updateProfileForUserId(req.user.userId, req.body);
  return ApiResponse.success(res, data, 'Profile updated successfully');
});
