import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  authenticateWithGoogle,
  refreshMobileSession,
  logoutMobileSession,
} from '../services/authService.js';

export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken, publicKey, publicKeyFingerprint } = req.body;
  const result = await authenticateWithGoogle(idToken, {
    publicKey,
    publicKeyFingerprint,
  });
  return ApiResponse.success(res, result, 'OK');
});

export const refreshAuth = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await refreshMobileSession(refreshToken);
  return ApiResponse.success(res, result, 'OK');
});

export const logoutAuth = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await logoutMobileSession(refreshToken);
  return ApiResponse.success(res, result, 'Logged out');
});
