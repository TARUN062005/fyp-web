import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import express from 'express';
import request from 'supertest';

process.env.RATE_LIMIT_WINDOW_MS = '600000';
process.env.RATE_LIMIT_UPLOAD_MAX = '3';

const { uploadRateLimiter, __resetRateLimiterForTests } = await import(
  '../middleware/rateLimiter.js'
);

describe('uploadRateLimiter', () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it('returns 429 after exceeding the upload threshold', async () => {
    const app = express();
    app.post('/sos/upload', uploadRateLimiter, (_req, res) => res.status(200).json({ ok: true }));
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).post('/sos/upload');
      assert.equal(res.status, 200);
    }
    const blocked = await request(app).post('/sos/upload');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.success, false);
  });
});
