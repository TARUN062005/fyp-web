/**
 * Confirms sensitiveRateLimiter returns 429 after exceeding the threshold.
 *
 * Usage:
 *   RATE_LIMIT_SENSITIVE_MAX=3 node src/scripts/verifyRateLimit.js
 *   npm run verify:rate-limit
 */
import mongoose from 'mongoose';
import request from 'supertest';

// Keep the window large but the max tiny so this test is fast and deterministic.
// Must be set before importing app (rateLimiter reads env at module load).
process.env.RATE_LIMIT_WINDOW_MS = process.env.RATE_LIMIT_WINDOW_MS || '600000';
process.env.RATE_LIMIT_SENSITIVE_MAX = process.env.RATE_LIMIT_SENSITIVE_MAX || '3';
process.env.RATE_LIMIT_GENERAL_MAX = process.env.RATE_LIMIT_GENERAL_MAX || '1000';

const { default: env } = await import('../config/env.js');
const { default: app } = await import('../app.js');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const max = Number(process.env.RATE_LIMIT_SENSITIVE_MAX);
  let lastStatus = null;

  for (let i = 1; i <= max; i += 1) {
    const res = await request(app)
      .post('/admin/auth/login')
      .send({ email: 'rate-limit@test.local', password: 'not-the-password' });
    lastStatus = res.status;
    // 401 invalid credentials is fine — we only care that the limiter hasn't tripped yet
    assert(
      res.status !== 429,
      `Unexpected 429 on attempt ${i} before threshold (${max})`
    );
    console.log(`[verify] attempt ${i}/${max} => ${res.status}`);
  }

  const blocked = await request(app)
    .post('/admin/auth/login')
    .send({ email: 'rate-limit@test.local', password: 'not-the-password' });

  assert(
    blocked.status === 429,
    `Expected 429 after exceeding ${max} attempts, got ${blocked.status} (last allowed=${lastStatus})`
  );
  assert(
    blocked.body?.success === false,
    '429 body should use consistent error shape'
  );

  console.log(`[verify] attempt ${max + 1} => ${blocked.status} ✓`);
  console.log('[verify] PASS — sensitive rate limiter triggered 429');

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});