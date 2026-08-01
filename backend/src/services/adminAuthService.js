import bcrypt from 'bcryptjs';
import AdminUser from '../models/AdminUser.js';
import { AppError } from '../utils/asyncHandler.js';
import {
  issueAdminTokenPair,
  rotateAdminRefreshToken,
  revokeAdminRefreshToken,
} from './adminTokenService.js';

export const loginAdmin = async (email, password) => {
  if (!email || !password) {
    throw new AppError('email and password are required', 400);
  }

  const admin = await AdminUser.findOne({ email: email.toLowerCase().trim() });
  if (!admin) {
    throw new AppError('Invalid email or password', 401);
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = await issueAdminTokenPair(admin._id, admin.role);

  return {
    ...tokens,
    admin: {
      id: String(admin._id),
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
    },
  };
};

export const refreshAdminSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('refreshToken is required', 400);
  }
  return rotateAdminRefreshToken(refreshToken);
};

export const logoutAdmin = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('refreshToken is required', 400);
  }
  return revokeAdminRefreshToken(refreshToken);
};

export const getAdminById = async (adminId) => {
  const admin = await AdminUser.findById(adminId).select('-passwordHash');
  if (!admin) {
    throw new AppError('Admin not found', 404);
  }
  return {
    id: String(admin._id),
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
  };
};
