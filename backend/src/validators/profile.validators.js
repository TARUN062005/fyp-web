import { z } from 'zod';

const optionalPhone = z
  .union([z.string().trim().max(32), z.null()])
  .optional();

/**
 * PATCH /profile — mobile Bearer.
 * `emergencyContact` is a phone string (Android Settings field), stored as
 * `{ phoneNumber }` on the User document for schema compatibility.
 */
export const patchProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(120),
    phoneNumber: optionalPhone,
    emergencyContact: optionalPhone,
  })
  .strict();
