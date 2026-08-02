import { z } from 'zod';

export const voteUploadBodySchema = z.object({
  voteId: z.string().min(1).max(128),
  voterId: z.string().min(1),
  messageId: z.string().min(1).max(128),
  voteType: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    z.enum(['TRUE', 'FALSE', 'UNKNOWN'])
  ),
  timestamp: z.union([z.string().datetime(), z.coerce.date()]),
});

export const consensusQuerySchema = z.object({
  since: z.string().optional(),
  messageIds: z.string().optional(), // comma-separated
});
