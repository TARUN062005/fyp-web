import {
  LATENCY_UNCERTAINTY_THRESHOLD_MS,
  METRIC_DEFINITIONS,
  MEASUREMENT_KIND_PHYSICAL,
} from '../config/experimentConstants.js';

const mean = (values) => {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const roundOrNull = (value, digits = 2) => {
  if (value == null || Number.isNaN(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const pct = (num, den) => {
  if (!den) return null;
  return roundOrNull((num / den) * 100, 2);
};

const isSenderEvent = (event, trialMeta) => {
  if (!trialMeta) return false;
  if (trialMeta.senderDeviceId && event.deviceId === trialMeta.senderDeviceId) return true;
  if (
    trialMeta.senderMeshUserId &&
    event.meshUserId &&
    event.meshUserId === trialMeta.senderMeshUserId
  ) {
    return true;
  }
  return false;
};

const isDestinationEvent = (event, trialMeta, receiverIds = emptyReceiverIds()) => {
  if (!trialMeta) return false;
  if (event.eventType !== 'MESSAGE_RECEIVED' && event.eventType !== 'MESSAGE_DELIVERED') {
    return false;
  }
  if (trialMeta.destinationDeviceId && event.deviceId === trialMeta.destinationDeviceId) {
    return true;
  }
  if (
    trialMeta.destinationMeshUserId &&
    event.meshUserId &&
    event.meshUserId === trialMeta.destinationMeshUserId
  ) {
    return true;
  }
  if (
    (receiverIds.mesh.has(event.meshUserId) || receiverIds.device.has(event.deviceId)) &&
    !isSenderEvent(event, trialMeta)
  ) {
    return true;
  }
  // Destination paste was missing: a non-sender MESSAGE_DELIVERED is still a dest receipt.
  // Relays only emit MESSAGE_RECEIVED, so they do not count.
  if (
    event.eventType === 'MESSAGE_DELIVERED' &&
    !trialMeta.destinationDeviceId &&
    !trialMeta.destinationMeshUserId &&
    !isSenderEvent(event, trialMeta)
  ) {
    return true;
  }
  return false;
};

const emptyReceiverIds = () => ({ mesh: new Set(), device: new Set() });

const receiverIdsFromDevices = (devices = []) => {
  const mesh = new Set();
  const device = new Set();
  for (const d of devices) {
    if (d?.role !== 'RECEIVER') continue;
    if (d.meshUserId) mesh.add(d.meshUserId);
    if (d.deviceId) device.add(d.deviceId);
  }
  return { mesh, device };
};

const firstExtraValue = (events, key) => {
  for (const event of events) {
    const value = event?.extra?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const trialMetaFromEvents = (events) => {
  const created = events.find((e) => e.eventType === 'MESSAGE_CREATED');
  const started = events.find((e) => e.eventType === 'TRIAL_STARTED');
  const seed = started || created || events[0];
  return {
    senderDeviceId: seed?.sourceDeviceId || seed?.deviceId || null,
    destinationDeviceId:
      seed?.destinationDeviceId ||
      events.find((e) => e.destinationDeviceId)?.destinationDeviceId ||
      null,
    destinationMeshUserId: firstExtraValue(events, 'destinationMeshUserId'),
    senderMeshUserId:
      seed?.meshUserId || firstExtraValue(events, 'senderMeshUserId') || null,
    scenario: seed?.scenario || null,
    messageId: created?.messageId || events.find((e) => e.messageId)?.messageId || null,
    skipped: events.some((e) => e.eventType === 'TRIAL_SKIPPED'),
  };
};

const computeLatency = (originEvent, destEvent) => {
  if (!originEvent || !destEvent) {
    return {
      latencyMs: null,
      latencyReliable: false,
      wallClockDeltaMs: null,
      clockUncertaintyMs: null,
      reason: 'missing_origin_or_destination_timestamp',
    };
  }

  const wallDelta = destEvent.wallClockMs - originEvent.wallClockMs;
  const originOff = originEvent.clockOffsetMs;
  const destOff = destEvent.clockOffsetMs;
  const uncertainty = Math.max(
    originEvent.clockUncertaintyMs ?? Number.POSITIVE_INFINITY,
    destEvent.clockUncertaintyMs ?? Number.POSITIVE_INFINITY
  );

  if (
    originOff == null ||
    destOff == null ||
    !Number.isFinite(uncertainty) ||
    uncertainty > LATENCY_UNCERTAINTY_THRESHOLD_MS
  ) {
    return {
      latencyMs: null,
      latencyReliable: false,
      wallClockDeltaMs: Number.isFinite(wallDelta) ? wallDelta : null,
      clockUncertaintyMs: Number.isFinite(uncertainty) ? uncertainty : null,
      reason:
        originOff == null || destOff == null
          ? 'missing_clock_offset'
          : 'clock_uncertainty_too_high',
    };
  }

  const latencyMs = (destEvent.wallClockMs - destOff) - (originEvent.wallClockMs - originOff);
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return {
      latencyMs: null,
      latencyReliable: false,
      wallClockDeltaMs: wallDelta,
      clockUncertaintyMs: uncertainty,
      reason: 'non_positive_adjusted_latency',
    };
  }

  return {
    latencyMs,
    latencyReliable: true,
    wallClockDeltaMs: wallDelta,
    clockUncertaintyMs: uncertainty,
    reason: null,
  };
};

export const reconstructTrial = (trialId, events, devices = []) => {
  const ordered = [...events].sort((a, b) => a.wallClockMs - b.wallClockMs);
  const meta = trialMetaFromEvents(ordered);
  const receiverIds = receiverIdsFromDevices(devices);
  const origin = ordered.find((e) => e.eventType === 'MESSAGE_CREATED') ||
    ordered.find((e) => e.eventType === 'TRIAL_STARTED');
  const firstReceive = ordered.find((e) => e.eventType === 'MESSAGE_RECEIVED');
  const destEvents = ordered.filter((e) => isDestinationEvent(e, meta, receiverIds));
  const destReceive = destEvents[0] || null;
  const ack = ordered.find((e) => e.eventType === 'MESSAGE_ACKNOWLEDGED');
  const hopLimit = ordered.find((e) => e.eventType === 'HOP_LIMIT_REACHED');
  const expired = ordered.find((e) => e.eventType === 'MESSAGE_EXPIRED');
  const cloudStarted = ordered.filter((e) => e.eventType === 'CLOUD_UPLOAD_STARTED');
  const cloudOk = ordered.filter((e) => e.eventType === 'CLOUD_UPLOAD_SUCCEEDED');
  const cloudFail = ordered.filter((e) => e.eventType === 'CLOUD_UPLOAD_FAILED');

  const delivered = Boolean(destReceive) && !meta.skipped;
  const latency = computeLatency(origin, destReceive);

  let failureReason = null;
  if (meta.skipped) failureReason = 'skipped';
  else if (!delivered) {
    failureReason =
      hopLimit?.errorCode ||
      expired?.errorCode ||
      cloudFail[0]?.errorCode ||
      'destination_receipt_not_confirmed';
  }

  let cloudUploadStatus = 'NOT_ATTEMPTED';
  if (cloudOk.length > 0) cloudUploadStatus = 'SUCCEEDED';
  else if (cloudFail.length > 0) cloudUploadStatus = 'FAILED';
  else if (cloudStarted.length > 0) cloudUploadStatus = 'STARTED_UNCONFIRMED';

  const destHop =
    destReceive?.hopCount == null ? null : Number(destReceive.hopCount);

  return {
    trialId,
    experimentId: ordered[0]?.experimentId || null,
    scenario: meta.scenario,
    senderDeviceId: meta.senderDeviceId,
    destinationDeviceId: meta.destinationDeviceId,
    senderMeshUserId: meta.senderMeshUserId,
    destinationMeshUserId: meta.destinationMeshUserId,
    messageId: meta.messageId,
    startedAtMs: origin?.wallClockMs ?? ordered[0]?.wallClockMs ?? null,
    messageCreatedAtMs: ordered.find((e) => e.eventType === 'MESSAGE_CREATED')?.wallClockMs ?? null,
    firstReceiveAtMs: firstReceive?.wallClockMs ?? null,
    destinationReceiveAtMs: destReceive?.wallClockMs ?? null,
    delivered,
    skipped: meta.skipped,
    hopCount: destHop,
    duplicateCount: ordered.filter((e) => e.eventType === 'DUPLICATE_DETECTED').length,
    forwardingAttempts: ordered.filter(
      (e) =>
        e.eventType === 'MESSAGE_FORWARDED' ||
        e.eventType === 'MESSAGE_TRANSMISSION_ATTEMPTED'
    ).length,
    acknowledged: Boolean(ack),
    cloudUploadStatus,
    cloudUploaderDeviceId: cloudOk[0]?.deviceId || cloudStarted[0]?.deviceId || null,
    originalSenderDeviceId: meta.senderDeviceId,
    latencyMs: latency.latencyReliable ? latency.latencyMs : null,
    latencyReliable: latency.latencyReliable,
    wallClockDeltaMs: latency.wallClockDeltaMs,
    clockUncertaintyMs: latency.clockUncertaintyMs,
    latencyUnreliableReason: latency.reason,
    failureReason: delivered ? null : failureReason,
    measurementKind: MEASUREMENT_KIND_PHYSICAL,
  };
};

export const summarizeTrials = (trials) => {
  const attempted = trials.filter((t) => !t.skipped);
  const successful = attempted.filter((t) => t.delivered);
  const failed = attempted.filter((t) => !t.delivered);
  const reliableLatencies = successful
    .map((t) => t.latencyMs)
    .filter((v) => v != null && Number.isFinite(v));
  const hops = successful
    .map((t) => t.hopCount)
    .filter((v) => v != null && Number.isFinite(v));

  const forwardingAttempts = attempted.reduce(
    (sum, t) => sum + (t.forwardingAttempts || 0),
    0
  );
  const duplicateSuppressionCount = attempted.reduce(
    (sum, t) => sum + (t.duplicateCount || 0),
    0
  );

  const cloudAttempted = attempted.filter(
    (t) => t.cloudUploadStatus !== 'NOT_ATTEMPTED'
  ).length;
  const cloudSucceeded = attempted.filter(
    (t) => t.cloudUploadStatus === 'SUCCEEDED'
  ).length;

  const routingOverhead =
    successful.length === 0
      ? null
      : roundOrNull(forwardingAttempts / successful.length, 3);

  return {
    totalTrialCount: attempted.length,
    successfulDeliveries: successful.length,
    failedTrialCount: failed.length,
    skippedTrialCount: trials.filter((t) => t.skipped).length,
    deliveryRatio: pct(successful.length, attempted.length),
    averageLatencyMs: roundOrNull(mean(reliableLatencies), 2),
    medianLatencyMs: roundOrNull(median(reliableLatencies), 2),
    latencySampleCount: reliableLatencies.length,
    unreliableLatencyCount: successful.length - reliableLatencies.length,
    averageHopCount: roundOrNull(mean(hops), 2),
    duplicateSuppressionCount,
    forwardingAttempts,
    routingOverhead,
    cloudRelayAttempted: cloudAttempted,
    cloudRelaySucceeded: cloudSucceeded,
    cloudRelaySuccessRate: pct(cloudSucceeded, cloudAttempted),
    definitions: METRIC_DEFINITIONS,
    measurementKind: MEASUREMENT_KIND_PHYSICAL,
  };
};

export const metricsByScenario = (trials) => {
  const groups = new Map();
  for (const trial of trials) {
    const key = trial.scenario || 'UNKNOWN';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trial);
  }
  const out = {};
  for (const [scenario, list] of groups.entries()) {
    out[scenario] = summarizeTrials(list);
  }
  return out;
};

const mergeEventsByMessageId = (byTrial) => {
  const createdOwners = new Map();
  for (const [trialId, list] of byTrial.entries()) {
    for (const event of list) {
      if (event.eventType !== 'MESSAGE_CREATED' || !event.messageId) continue;
      if (!createdOwners.has(event.messageId)) createdOwners.set(event.messageId, new Set());
      createdOwners.get(event.messageId).add(trialId);
    }
  }
  const uniqueHome = new Map();
  for (const [messageId, owners] of createdOwners.entries()) {
    if (owners.size === 1) uniqueHome.set(messageId, [...owners][0]);
  }
  for (const [trialId, list] of [...byTrial.entries()]) {
    if (list.some((e) => e.eventType === 'MESSAGE_CREATED')) continue;
    const homes = new Set(
      list.map((e) => (e.messageId ? uniqueHome.get(e.messageId) : null)).filter(Boolean)
    );
    if (homes.size !== 1) continue;
    const home = [...homes][0];
    if (home === trialId) continue;
    byTrial.get(home).push(...list);
    byTrial.delete(trialId);
  }
  return byTrial;
};

export const calculateExperimentResults = (events, devices = []) => {
  const byTrial = new Map();
  for (const event of events) {
    if (!event.trialId) continue;
    if (!byTrial.has(event.trialId)) byTrial.set(event.trialId, []);
    byTrial.get(event.trialId).push(event);
  }
  mergeEventsByMessageId(byTrial);
  const trials = [...byTrial.entries()].map(([trialId, list]) =>
    reconstructTrial(trialId, list, devices)
  );
  return {
    trials,
    summary: summarizeTrials(trials),
    byScenario: metricsByScenario(trials),
  };
};

export { mean, median, computeLatency, isDestinationEvent };
