import { z } from 'zod';

export const googleAuthBodySchema = z.object({
  idToken: z.string().min(1),
  /** Required when creating a new identity; optional on restore / reinstall. */
  publicKey: z.string().min(1).optional(),
  publicKeyFingerprint: z.string().min(1).optional(),
});

export const adminLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminRefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

export const mobileRefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
