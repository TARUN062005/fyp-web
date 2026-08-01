import crypto from 'crypto';
import {
  generateToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/jwt.js';
import RefreshToken from '../models/RefreshToken.js';
import env from '../config/env.js';
import { AppError } from '../utils/asyncHandler.js';

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const refreshTtlMs = () => {
  const raw = env.jwtRefreshExpiresIn;
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = match[2];
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return n * mult;
};

export const issueTokenPair = async (userId) => {
  const userIdStr = String(userId);
  const jti = crypto.randomUUID();
  const accessToken = generateToken({ userId: userIdStr });
  const refreshToken = generateRefreshToken({
    userId: userIdStr,
    jti,
  });

  await RefreshToken.create({
    userId,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + refreshTtlMs()),
    revokedAt: null,
  });

  return { accessToken, refreshToken };
};

/**
 * Honor a mobile refresh token only if its jti/hash exists, is unexpired,
 * and has not been revoked (logout / rotation).
 */
export const rotateRefreshToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  if (!decoded.jti || !decoded.userId) {
    throw new AppError('Invalid refresh token', 401);
  }

  const record = await RefreshToken.findOne({
    jti: decoded.jti,
    tokenHash: hashToken(refreshToken),
    userId: decoded.userId,
  });

  if (!record || record.revokedAt || record.expiresAt <= new Date()) {
    throw new AppError('Refresh token revoked or expired', 401);
  }

  record.revokedAt = new Date();
  await record.save();

  return issueTokenPair(decoded.userId);
};

export const revokeRefreshToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  if (!decoded.jti) {
    throw new AppError('Invalid refresh token', 401);
  }

  const record = await RefreshToken.findOne({
    jti: decoded.jti,
    tokenHash: hashToken(refreshToken),
    userId: decoded.userId,
  });

  if (!record) {
    throw new AppError('Refresh token not found', 401);
  }

  if (!record.revokedAt) {
    record.revokedAt = new Date();
    await record.save();
  }

  return { revoked: true };
};
