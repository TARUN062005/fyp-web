import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createExperimentBodySchema,
  experimentEventSchema,
  batchEventsBodySchema,
} from '../validators/experiment.validators.js';

describe('experiment validators', () => {
  it('accepts a valid create body', () => {
    const parsed = createExperimentBodySchema.parse({
      experimentId: '11111111-2222-3333-4444-555555555555',
      name: 'Lab run',
      scenario: 'DIRECT_BROADCAST',
      participantCount: 2,
    });
    assert.equal(parsed.scenario, 'DIRECT_BROADCAST');
  });

  it('rejects unknown scenarios', () => {
    assert.throws(() =>
      createExperimentBodySchema.parse({
        experimentId: 'exp-enough',
        name: 'x',
        scenario: 'EPIDEMIC_UNLIMITED',
        participantCount: 2,
      })
    );
  });

  it('strips private chat / emergency content keys from event extra', () => {
    const parsed = experimentEventSchema.parse({
      eventId: 'evt-12345678',
      trialId: 'trial-12345678',
      eventType: 'MESSAGE_CREATED',
      deviceId: 'phone-a',
      wallClockMs: Date.now(),
      scenario: 'PRIVATE_CHAT',
      extra: {
        content: 'secret hello',
        plaintext: 'nope',
        connectionStatus: 'CONNECTED',
      },
    });
    assert.equal(parsed.extra?.content, undefined);
    assert.equal(parsed.extra?.plaintext, undefined);
    assert.equal(parsed.extra?.connectionStatus, 'CONNECTED');
  });

  it('rejects empty event batches', () => {
    assert.throws(() =>
      batchEventsBodySchema.parse({
        deviceId: 'phone-a',
        events: [],
      })
    );
  });
});
