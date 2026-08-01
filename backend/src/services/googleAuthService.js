import { OAuth2Client } from 'google-auth-library';
import env from '../config/env.js';
import { AppError } from '../utils/asyncHandler.js';

const client = new OAuth2Client(env.googleClientId);

/**
 * Verifies a Google ID token and returns the stable account subject.
 * Mock tokens (`mock:<googleAccountId>:<displayName>`) are accepted only when
 * NODE_ENV !== "production" AND GOOGLE_AUTH_MOCK === "true".
 */
export const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new AppError('Google ID token is required', 400);
  }

  const allowMock =
    process.env.NODE_ENV !== 'production' &&
    process.env.GOOGLE_AUTH_MOCK === 'true';

  if (allowMock) {
    if (!idToken.startsWith('mock:')) {
      throw new AppError('Invalid mock Google ID token', 401);
    }
    const [, googleAccountId, ...nameParts] = idToken.split(':');
    const displayName = nameParts.join(':') || 'Mock User';
    if (!googleAccountId) {
      throw new AppError('Invalid mock Google ID token', 401);
    }
    return { googleAccountId, displayName, email: null };
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
  } catch {
    throw new AppError('Invalid Google ID token', 401);
  }

  const payload = ticket.getPayload();
  if (!payload?.sub) {
    throw new AppError('Invalid Google ID token payload', 401);
  }

  return {
    googleAccountId: payload.sub,
    displayName: payload.name || payload.email || 'User',
    email: payload.email || null,
  };
};
