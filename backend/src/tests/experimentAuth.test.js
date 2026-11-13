import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import app from '../app.js';

describe('experiment API auth', () => {
  it('rejects unauthenticated experiment create', async () => {
    const res = await request(app).post('/experiments').send({
      experimentId: '11111111-2222-3333-4444-555555555555',
      name: 'x',
      scenario: 'DIRECT_BROADCAST',
      participantCount: 2,
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('rejects unauthenticated event batch upload', async () => {
    const res = await request(app)
      .post('/experiments/exp-1/events/batch')
      .send({ deviceId: 'd', events: [] });
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated admin experiment list', async () => {
    const res = await request(app).get('/admin/experiments');
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated admin PDF report', async () => {
    const res = await request(app).get('/admin/experiments/exp-1/report');
    assert.equal(res.status, 401);
  });
});
