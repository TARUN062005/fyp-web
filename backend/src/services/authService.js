import crypto from 'crypto';
import User from '../models/User.js';
import { AppError } from '../utils/asyncHandler.js';
import { verifyGoogleIdToken } from './googleAuthService.js';
import {
  issueCertificate,
  getLatestCertificate,
  toCertificateDto,
} from './certificateService.js';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
} from './tokenService.js';

const EMERGENCY_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const fingerprintPublicKey = (publicKey) =>
  crypto.createHash('sha256').update(publicKey).digest('hex');

const toPublicProfile = (user) => ({
  emergencyId: user.emergencyId,
  displayName: user.displayName,
  publicKeyFingerprint: user.publicKeyFingerprint,
  emergencyContact: user.emergencyContact ?? null,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  lastSeenAt: user.lastSeenAt,
});

const assertNotBlocked = (user) => {
  if (user.isBlocked) {
    throw new AppError('Account is blocked', 403);
  }
};

const generateEmergencyId = () => {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += EMERGENCY_ID_ALPHABET[crypto.randomInt(0, EMERGENCY_ID_ALPHABET.length)];
  }
  return `EDTN-${suffix}`;
};

/**
 * Allocates EDTN-XXXXX with retry ONLY on emergencyId collisions.
 * googleAccountId unique-index conflicts are NOT retried into a new User —
 * they propagate so the caller can restore the existing identity
 * (Sybil mitigation: one identity per Google account).
 */
const createUserWithUniqueEmergencyId = async (fields) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const emergencyId = generateEmergencyId();
    try {
      return await User.create({ ...fields, emergencyId });
    } catch (err) {
      if (err?.code === 11000 && err?.keyPattern?.emergencyId) {
        continue;
      }
      throw err;
    }
  }
  throw new AppError('Could not allocate a unique emergencyId', 500);
};

const completeSession = async (user) => {
  assertNotBlocked(user);
  user.lastSeenAt = new Date();
  await user.save();
  const tokens = await issueTokenPair(user._id);
  return {
    status: 'authenticated',
    ...tokens,
    profile: toPublicProfile(user),
  };
};

/**
 * Storage-clear / reinstall: same emergencyId, new device key → fresh certificate.
 */
const reassociatePublicKeyIfNeeded = async (
  user,
  publicKey,
  publicKeyFingerprint
) => {
  if (!publicKey || typeof publicKey !== 'string') {
    return null;
  }
  if (user.publicKey === publicKey) {
    return null;
  }

  user.publicKey = publicKey;
  user.publicKeyFingerprint =
    publicKeyFingerprint?.trim() || fingerprintPublicKey(publicKey);
  await user.save();

  return issueCertificate(user.emergencyId, publicKey);
};

/**
 * Google-only identity: restore by googleAccountId, or create a new permanent
 * emergencyId + IdentityCertificate when publicKey is supplied.
 */
export const authenticateWithGoogle = async (
  idToken,
  { publicKey, publicKeyFingerprint } = {}
) => {
  const { googleAccountId, displayName } = await verifyGoogleIdToken(idToken);

  const existing = await User.findOne({ googleAccountId });
  if (existing) {
    const certificate = await reassociatePublicKeyIfNeeded(
      existing,
      publicKey,
      publicKeyFingerprint
    );
    const session = await completeSession(existing);
    return {
      ...session,
      status: 'restored',
      ...(certificate && {
        identityCertificate: toCertificateDto(certificate),
      }),
    };
  }

  if (!publicKey || typeof publicKey !== 'string') {
    throw new AppError('publicKey is required to create a new identity', 400);
  }

  const fingerprint =
    publicKeyFingerprint?.trim() || fingerprintPublicKey(publicKey);

  let user;
  try {
    user = await createUserWithUniqueEmergencyId({
      googleAccountId,
      displayName: displayName || 'User',
      publicKey,
      publicKeyFingerprint: fingerprint,
      isVerified: true,
      lastSeenAt: new Date(),
    });
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await User.findOne({ googleAccountId });
      if (raced) {
        const certificate = await reassociatePublicKeyIfNeeded(
          raced,
          publicKey,
          publicKeyFingerprint
        );
        const session = await completeSession(raced);
        return {
          ...session,
          status: 'restored',
          ...(certificate && {
            identityCertificate: toCertificateDto(certificate),
          }),
        };
      }
    }
    throw err;
  }

  const certificate = await issueCertificate(user.emergencyId, publicKey);
  const session = await completeSession(user);
  return {
    ...session,
    status: 'created',
    identityCertificate: toCertificateDto(certificate),
  };
};

export const refreshMobileSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('refreshToken is required', 400);
  }
  return rotateRefreshToken(refreshToken);
};

export const logoutMobileSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('refreshToken is required', 400);
  }
  return revokeRefreshToken(refreshToken);
};

export const getProfileForUserId = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  assertNotBlocked(user);
  return toPublicProfile(user);
};

export const getCertificateForUserId = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  assertNotBlocked(user);

  const certificate = await getLatestCertificate(user.emergencyId);
  if (!certificate) {
    throw new AppError('No identity certificate found', 404);
  }

  return toCertificateDto(certificate);
};
