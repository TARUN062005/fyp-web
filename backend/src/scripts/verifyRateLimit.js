/**
 * Confirms uploadRateLimiter returns 429 after exceeding the threshold.
 * Admin login is intentionally unrestricted.
 *
 * Usage:
 *   RATE_LIMIT_UPLOAD_MAX=3 node src/scripts/verifyRateLimit.js
 *   npm run verify:rate-limit
 */
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '600000';
process.env.RATE_LIMIT_UPLOAD_MAX = process.env.RATE_LIMIT_UPLOAD_MAX || '3';

import express from 'express';
import request from 'supertest';
import { uploadRateLimiter, __resetRateLimiterForTests } from '../middleware/rateLimiter.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

__resetRateLimiterForTests();
const app = express();
app.post('/sos/upload', uploadRateLimiter, (_req, res) => {
  res.status(200).json({ success: true });
});

const max = Number(process.env.RATE_LIMIT_UPLOAD_MAX);
let lastStatus = null;
for (let i = 1; i <= max; i += 1) {
  const res = await request(app).post('/sos/upload');
  lastStatus = res.status;
  assert(res.status !== 429, `Unexpected 429 on attempt ${i} before threshold (${max})`);
  console.log(`[verify] attempt ${i}/${max} => ${res.status}`);
}
const blocked = await request(app).post('/sos/upload');
assert(
  blocked.status === 429,
  `Expected 429 after exceeding ${max} attempts, got ${blocked.status} (last allowed=${lastStatus})`
);
assert(blocked.body?.success === false, '429 body should use consistent error shape');
console.log(`[verify] attempt ${max + 1} => ${blocked.status} ✓`);
console.log('[verify] PASS — upload rate limiter triggered 429');
