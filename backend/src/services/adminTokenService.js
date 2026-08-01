import crypto from 'crypto';
import {
  generateAdminToken,
  generateAdminRefreshToken,
  verifyAdminRefreshToken,
} from '../utils/jwt.js';
import AdminRefreshToken from '../models/AdminRefreshToken.js';
import env from '../config/env.js';
import { AppError } from '../utils/asyncHandler.js';

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const parseTtlMs = (raw, fallbackMs) => {
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return fallbackMs;
  const n = Number(match[1]);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return n * mult;
};

export const issueAdminTokenPair = async (adminId, role) => {
  const adminIdStr = String(adminId);
  const jti = crypto.randomUUID();
  const accessToken = generateAdminToken({ adminId: adminIdStr, role });
  const refreshToken = generateAdminRefreshToken({
    adminId: adminIdStr,
    role,
    jti,
  });

  await AdminRefreshToken.create({
    adminId,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(
      Date.now() +
        parseTtlMs(env.adminJwtRefreshExpiresIn, 7 * 24 * 60 * 60 * 1000)
    ),
    revokedAt: null,
  });

  return { accessToken, refreshToken };
};

export const rotateAdminRefreshToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyAdminRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid admin refresh token', 401);
  }

  if (!decoded.jti || !decoded.adminId) {
    throw new AppError('Invalid admin refresh token', 401);
  }

  const record = await AdminRefreshToken.findOne({
    jti: decoded.jti,
    tokenHash: hashToken(refreshToken),
    adminId: decoded.adminId,
  });

  if (!record || record.revokedAt || record.expiresAt <= new Date()) {
    throw new AppError('Admin refresh token revoked or expired', 401);
  }

  record.revokedAt = new Date();
  await record.save();

  return issueAdminTokenPair(decoded.adminId, decoded.role);
};

export const revokeAdminRefreshToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyAdminRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid admin refresh token', 401);
  }

  if (!decoded.jti) {
    throw new AppError('Invalid admin refresh token', 401);
  }

  const record = await AdminRefreshToken.findOne({
    jti: decoded.jti,
    tokenHash: hashToken(refreshToken),
    adminId: decoded.adminId,
  });

  if (!record) {
    throw new AppError('Admin refresh token not found', 401);
  }

  if (!record.revokedAt) {
    record.revokedAt = new Date();
    await record.save();
  }

  return { revoked: true };
};
