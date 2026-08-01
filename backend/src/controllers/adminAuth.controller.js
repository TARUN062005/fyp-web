import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  loginAdmin,
  refreshAdminSession,
  logoutAdmin,
  getAdminById,
} from '../services/adminAuthService.js';

export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginAdmin(email, password);
  return ApiResponse.success(res, result, 'OK');
});

export const adminRefresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await refreshAdminSession(refreshToken);
  return ApiResponse.success(res, result, 'OK');
});

export const adminLogout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const result = await logoutAdmin(refreshToken);
  return ApiResponse.success(res, result, 'Logged out');
});

/** Minimal admin-only probe route for auth boundary checks */
export const adminMe = asyncHandler(async (req, res) => {
  const admin = await getAdminById(req.admin.adminId);
  return ApiResponse.success(res, admin, 'OK');
});
