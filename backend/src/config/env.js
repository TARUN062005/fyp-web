import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_JWT_SECRET',
  'ADMIN_JWT_REFRESH_SECRET',
  'GOOGLE_CLIENT_ID',
  'ADMIN_ORIGIN',
  'CERT_SIGNING_PRIVATE_KEY',
];

const missing = REQUIRED_VARS.filter((key) => {
  const value = process.env[key];
  return value === undefined || String(value).trim() === '';
});

if (missing.length > 0) {
  console.error(
    `[env] Missing required environment variable(s): ${missing.join(', ')}`
  );
  console.error(
    '[env] Set them in backend/.env (see .env.example). Refusing to start.'
  );
  process.exit(1);
}

if (process.env.ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
  console.error('[env] ADMIN_JWT_SECRET must be different from JWT_SECRET');
  process.exit(1);
}
if (process.env.ADMIN_JWT_REFRESH_SECRET === process.env.JWT_REFRESH_SECRET) {
  console.error(
    '[env] ADMIN_JWT_REFRESH_SECRET must be different from JWT_REFRESH_SECRET'
  );
  process.exit(1);
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.GOOGLE_AUTH_MOCK === 'true'
) {
  console.error(
    '[env] GOOGLE_AUTH_MOCK cannot be enabled when NODE_ENV=production'
  );
  process.exit(1);
}

/**
 * Parse ADMIN_ORIGIN as a single origin or comma-separated list.
 * Wildcards ("*") are never allowed — especially in production.
 */
const parseAdminOrigins = (raw) => {
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    console.error('[env] ADMIN_ORIGIN must list at least one origin');
    process.exit(1);
  }

  if (parts.some((o) => o === '*')) {
    console.error(
      '[env] ADMIN_ORIGIN must not be "*" — set the admin frontend origin(s) explicitly'
    );
    process.exit(1);
  }

  return parts;
};

const adminOrigins = parseAdminOrigins(process.env.ADMIN_ORIGIN);

const googleAuthMock =
  process.env.NODE_ENV !== 'production' &&
  process.env.GOOGLE_AUTH_MOCK === 'true';

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET,
  adminJwtRefreshSecret: process.env.ADMIN_JWT_REFRESH_SECRET,
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '15m',
  adminJwtRefreshExpiresIn: process.env.ADMIN_JWT_REFRESH_EXPIRES_IN || '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleAuthMock,
  certSigningPrivateKey: process.env.CERT_SIGNING_PRIVATE_KEY,
  certSigningPublicKey: process.env.CERT_SIGNING_PUBLIC_KEY || '',
  /** First origin (backward compatible) */
  adminOrigin: adminOrigins[0],
  /** Full allow-list for CORS */
  adminOrigins,
});

export default env;
