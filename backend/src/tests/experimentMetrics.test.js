import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateExperimentResults,
  reconstructTrial,
  computeLatency,
} from '../services/experimentMetrics.js';
import { LATENCY_UNCERTAINTY_THRESHOLD_MS } from '../config/experimentConstants.js';

const ev = (overrides) => ({
  eventId: overrides.eventId || 'e',
  experimentId: 'exp-1',
  trialId: 'trial-1',
  messageId: 'msg-1',
  eventType: 'MESSAGE_RECEIVED',
  deviceId: 'dev-b',
  meshUserId: 'mesh-b',
  wallClockMs: 1_000,
  clockOffsetMs: 0,
  clockUncertaintyMs: 20,
  scenario: 'DIRECT_BROADCAST',
  hopCount: 1,
  ...overrides,
});

describe('experiment metrics', () => {
  it('counts destination receipt as success and relay receipt as not delivery', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'TRIAL_STARTED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-c',
        wallClockMs: 1000,
        extra: { destinationMeshUserId: 'mesh-c' },
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-c',
        wallClockMs: 1010,
      }),
      ev({
        eventId: '3',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1100,
      }),
      ev({
        eventId: '4',
        eventType: 'MESSAGE_FORWARDED',
        deviceId: 'dev-b',
        hopCount: 2,
        wallClockMs: 1110,
      }),
      ev({
        eventId: '5',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-c',
        meshUserId: 'mesh-c',
        hopCount: 2,
        wallClockMs: 1200,
      }),
    ];
    const trial = reconstructTrial('trial-1', events);
    assert.equal(trial.delivered, true);
    assert.equal(trial.hopCount, 2);
    assert.equal(trial.firstReceiveAtMs, 1100);
    assert.equal(trial.destinationReceiveAtMs, 1200);
  });

  it('does not treat relay-only receipt as success', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-c',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        hopCount: 1,
        wallClockMs: 1100,
      }),
    ];
    const trial = reconstructTrial('trial-1', events);
    assert.equal(trial.delivered, false);
    assert.equal(trial.failureReason, 'destination_receipt_not_confirmed');
  });

  it('keeps failed trials in totals and never fills latency with zero', () => {
    const events = [
      ev({
        eventId: 'a1',
        trialId: 't-fail',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-b',
        wallClockMs: 1000,
        clockOffsetMs: null,
        clockUncertaintyMs: null,
      }),
      ev({
        eventId: 'b1',
        trialId: 't-ok',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-b',
        wallClockMs: 2000,
        clockOffsetMs: 0,
        clockUncertaintyMs: 10,
      }),
      ev({
        eventId: 'b2',
        trialId: 't-ok',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        destinationDeviceId: 'dev-b',
        wallClockMs: 2250,
        hopCount: 1,
        clockOffsetMs: 0,
        clockUncertaintyMs: 10,
      }),
    ];
    const { summary, trials } = calculateExperimentResults(events);
    assert.equal(summary.totalTrialCount, 2);
    assert.equal(summary.failedTrialCount, 1);
    assert.equal(summary.successfulDeliveries, 1);
    assert.equal(summary.averageLatencyMs, 250);
    const failed = trials.find((t) => t.trialId === 't-fail');
    assert.equal(failed.latencyMs, null);
    assert.equal(failed.delivered, false);
  });

  it('flags latency unreliable when clock uncertainty is high', () => {
    const latency = computeLatency(
      ev({
        eventType: 'MESSAGE_CREATED',
        deviceId: 'a',
        wallClockMs: 1000,
        clockOffsetMs: 5,
        clockUncertaintyMs: LATENCY_UNCERTAINTY_THRESHOLD_MS + 1,
      }),
      ev({
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'b',
        wallClockMs: 1400,
        clockOffsetMs: 8,
        clockUncertaintyMs: 10,
      })
    );
    assert.equal(latency.latencyReliable, false);
    assert.equal(latency.latencyMs, null);
    assert.equal(latency.reason, 'clock_uncertainty_too_high');
  });

  it('requires backend CLOUD_UPLOAD_SUCCEEDED for cloud success rate', () => {
    const events = [
      ev({
        eventId: 'c1',
        trialId: 'cloud-1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        destinationDeviceId: 'dev-b',
        wallClockMs: 1,
      }),
      ev({
        eventId: 'c2',
        trialId: 'cloud-1',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        wallClockMs: 2,
        hopCount: 1,
      }),
      ev({
        eventId: 'c3',
        trialId: 'cloud-1',
        eventType: 'CLOUD_UPLOAD_STARTED',
        deviceId: 'dev-relay',
        wallClockMs: 3,
      }),
    ];
    const trial = reconstructTrial('cloud-1', events);
    assert.equal(trial.cloudUploadStatus, 'STARTED_UNCONFIRMED');
    const { summary } = calculateExperimentResults(events);
    assert.equal(summary.cloudRelaySuccessRate, 0);
  });

  it('defines routing overhead as transmissions per successful delivery', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'a',
        sourceDeviceId: 'a',
        destinationDeviceId: 'c',
        wallClockMs: 1,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_TRANSMISSION_ATTEMPTED',
        deviceId: 'a',
        wallClockMs: 2,
      }),
      ev({
        eventId: '3',
        eventType: 'MESSAGE_FORWARDED',
        deviceId: 'b',
        wallClockMs: 3,
      }),
      ev({
        eventId: '4',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'c',
        wallClockMs: 4,
        hopCount: 2,
      }),
    ];
    const { summary } = calculateExperimentResults(events);
    assert.equal(summary.forwardingAttempts, 1);
    assert.equal(summary.distinctForwards, 1);
    assert.equal(summary.routingOverhead, 1);
  });

  it('counts non-sender MESSAGE_DELIVERED when destination ids were not uploaded', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'TRIAL_STARTED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
        extra: {},
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1010,
      }),
      ev({
        eventId: '3',
        eventType: 'MESSAGE_DELIVERED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1200,
      }),
    ];
    const trial = reconstructTrial('trial-1', events);
    assert.equal(trial.delivered, true);
    assert.equal(trial.failureReason, null);
    assert.equal(trial.hopCount, 1);
  });

  it('does not use cloud HTTP errors as mesh delivery failure', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        eventType: 'CLOUD_UPLOAD_FAILED',
        deviceId: 'dev-a',
        errorCode: 'http_500',
        wallClockMs: 1300,
      }),
    ];
    const trial = reconstructTrial('trial-1', events);
    assert.equal(trial.delivered, false);
    assert.equal(trial.failureReason, 'destination_receipt_not_confirmed');
    assert.equal(trial.cloudUploadStatus, 'FAILED');
  });

  it('destination receipt wins even when cloud upload returned HTTP 500', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1200,
      }),
      ev({
        eventId: '3',
        eventType: 'CLOUD_UPLOAD_FAILED',
        deviceId: 'dev-b',
        errorCode: 'http_500',
        wallClockMs: 1400,
      }),
    ];
    const trial = reconstructTrial('trial-1', events, [
      { role: 'RECEIVER', deviceId: 'dev-b', meshUserId: 'mesh-b' },
    ]);
    assert.equal(trial.delivered, true);
    assert.equal(trial.failureReason, null);
  });

  it('receiver TRIAL_STARTED earlier than sender does not steal sender identity', () => {
    const events = [
      ev({
        eventId: '0',
        eventType: 'TRIAL_STARTED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        wallClockMs: 900,
      }),
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1010,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1200,
      }),
    ];
    const trial = reconstructTrial('trial-1', events, [
      { role: 'RECEIVER', deviceId: 'dev-b', meshUserId: 'mesh-b' },
    ]);
    assert.equal(trial.senderDeviceId, 'dev-a');
    assert.equal(trial.delivered, true);
    assert.equal(trial.failureReason, null);
  });

  it('does not treat sender MESSAGE_DELIVERED as destination receipt', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_DELIVERED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1300,
      }),
    ];
    const trial = reconstructTrial('trial-1', events);
    assert.equal(trial.delivered, false);
    assert.equal(trial.failureReason, 'destination_receipt_not_confirmed');
  });

  it('counts non-sender MESSAGE_DELIVERED even when destination mesh was pasted', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
        extra: { destinationMeshUserId: 'mesh-b' },
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_DELIVERED',
        deviceId: 'dev-b',
        meshUserId: '',
        hopCount: 1,
        wallClockMs: 1400,
      }),
    ];
    const trial = reconstructTrial('trial-1', events, [
      { role: 'RECEIVER', deviceId: 'dev-b', meshUserId: 'mesh-b' },
    ]);
    assert.equal(trial.delivered, true);
    assert.equal(trial.hopCount, 1);
  });

  it('counts RECEIVER-device receipts as destination delivery', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        sourceDeviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1200,
      }),
    ];
    const trial = reconstructTrial('trial-1', events, [
      { role: 'SENDER', deviceId: 'dev-a', meshUserId: 'mesh-a' },
      { role: 'RECEIVER', deviceId: 'dev-b', meshUserId: 'mesh-b' },
    ]);
    assert.equal(trial.delivered, true);
    assert.equal(trial.hopCount, 1);
  });

  it('merges receiver events into the sender trial by messageId', () => {
    const events = [
      ev({
        eventId: '1',
        trialId: 'sender-trial',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'dev-a',
        meshUserId: 'mesh-a',
        wallClockMs: 1000,
      }),
      ev({
        eventId: '2',
        trialId: 'receiver-trial',
        eventType: 'MESSAGE_RECEIVED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1300,
      }),
      ev({
        eventId: '3',
        trialId: 'receiver-trial',
        eventType: 'MESSAGE_DELIVERED',
        deviceId: 'dev-b',
        meshUserId: 'mesh-b',
        hopCount: 1,
        wallClockMs: 1301,
      }),
    ];
    const { summary, trials } = calculateExperimentResults(events, [
      { role: 'RECEIVER', deviceId: 'dev-b', meshUserId: 'mesh-b' },
    ]);
    assert.equal(summary.successfulDeliveries, 1);
    assert.equal(summary.failedTrialCount, 0);
    assert.equal(trials.length, 1);
    assert.equal(trials[0].delivered, true);
  });

  it('returns null routing overhead when there are no successful deliveries', () => {
    const events = [
      ev({
        eventId: '1',
        eventType: 'MESSAGE_CREATED',
        deviceId: 'a',
        sourceDeviceId: 'a',
        destinationDeviceId: 'c',
        wallClockMs: 1,
      }),
      ev({
        eventId: '2',
        eventType: 'MESSAGE_TRANSMISSION_ATTEMPTED',
        deviceId: 'a',
        wallClockMs: 2,
      }),
    ];
    const { summary } = calculateExperimentResults(events);
    assert.equal(summary.routingOverhead, null);
    assert.equal(summary.deliveryRatio, 0);
  });
});
