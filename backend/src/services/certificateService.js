import crypto from 'crypto';
import env from '../config/env.js';
import IdentityCertificate from '../models/IdentityCertificate.js';
import { AppError } from '../utils/asyncHandler.js';

const CERT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const pemFromEnv = (value) => {
  if (!value) return null;
  return value.includes('-----BEGIN')
    ? value.replace(/\\n/g, '\n')
    : value;
};

let cachedPrivateKey = null;

const getSigningKey = () => {
  if (cachedPrivateKey) return cachedPrivateKey;

  const pem = pemFromEnv(env.certSigningPrivateKey);
  try {
    cachedPrivateKey = crypto.createPrivateKey(pem);
  } catch {
    throw new AppError('Invalid CERT_SIGNING_PRIVATE_KEY', 500);
  }

  if (cachedPrivateKey.asymmetricKeyType !== 'ed25519') {
    throw new AppError('CERT_SIGNING_PRIVATE_KEY must be an Ed25519 private key', 500);
  }

  return cachedPrivateKey;
};

/**
 * Stable bytes that the server signs and the Android app will verify
 * with the baked-in certificate-signing public key.
 */
export const canonicalCertificateBytes = ({
  emergencyId,
  publicKey,
  issuedAt,
  expiresAt,
}) => {
  const payload = {
    emergencyId,
    publicKey,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
  return Buffer.from(JSON.stringify(payload), 'utf8');
};

const signPayload = (payload) => {
  const signature = crypto.sign(null, canonicalCertificateBytes(payload), getSigningKey());
  return signature.toString('base64url');
};

export const toCertificateDto = (certificate) => ({
  emergencyId: certificate.emergencyId,
  publicKey: certificate.publicKey,
  issuedAt: certificate.issuedAt,
  expiresAt: certificate.expiresAt,
  serverSignature: certificate.serverSignature,
});

/**
 * Internal signing service — not mounted as a public route.
 * Invoked on identity creation and public-key re-association (restore).
 */
export const issueCertificate = async (emergencyId, publicKey) => {
  if (!emergencyId || !publicKey) {
    throw new AppError('emergencyId and publicKey are required to issue a certificate', 400);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CERT_TTL_MS);
  const serverSignature = signPayload({
    emergencyId,
    publicKey,
    issuedAt,
    expiresAt,
  });

  const certificate = await IdentityCertificate.create({
    emergencyId,
    publicKey,
    issuedAt,
    expiresAt,
    serverSignature,
  });

  return certificate;
};

export const getLatestCertificate = async (emergencyId) => {
  return IdentityCertificate.findOne({ emergencyId })
    .sort({ issuedAt: -1 })
    .lean();
};

export const verifyCertificateSignature = (certificate) => {
  const publicPem = pemFromEnv(env.certSigningPublicKey);
  if (!publicPem) {
    throw new AppError('CERT_SIGNING_PUBLIC_KEY is not configured', 500);
  }

  const key = crypto.createPublicKey(publicPem);
  return crypto.verify(
    null,
    canonicalCertificateBytes(certificate),
    key,
    Buffer.from(certificate.serverSignature, 'base64url')
  );
};
