export const EXPERIMENT_SCENARIOS = [
  'DIRECT_BROADCAST',
  'PRIVATE_CHAT',
  'THREE_PHONE_LINE',
  'FOUR_PHONE_LINE',
  'DUPLICATE_SUPPRESSION',
  'OFFLINE_SENDER_TO_INTERNET_RELAY',
  'HOP_LIMIT',
];

export const EXPERIMENT_ROLES = ['SENDER', 'RELAY', 'RECEIVER', 'GATEWAY'];

export const EXPERIMENT_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED'];

export const EXPERIMENT_EVENT_TYPES = [
  'MESSAGE_CREATED',
  'MESSAGE_SEND_STARTED',
  'MESSAGE_TRANSMISSION_ATTEMPTED',
  'MESSAGE_RECEIVED',
  'MESSAGE_FORWARDED',
  'MESSAGE_DELIVERED',
  'MESSAGE_ACKNOWLEDGED',
  'DUPLICATE_DETECTED',
  'MESSAGE_EXPIRED',
  'HOP_LIMIT_REACHED',
  'CLOUD_UPLOAD_STARTED',
  'CLOUD_UPLOAD_SUCCEEDED',
  'CLOUD_UPLOAD_FAILED',
  'TRIAL_STARTED',
  'TRIAL_STOPPED',
  'TRIAL_SKIPPED',
  'CLOCK_PROBE',
];

export const MEASUREMENT_KIND_PHYSICAL = 'PHYSICAL_ANDROID';
export const MEASUREMENT_KIND_SIMULATION = 'SIMULATION';

/** Cross-device latency is flagged unreliable above this clock uncertainty. */
export const LATENCY_UNCERTAINTY_THRESHOLD_MS = 1000;

export const FORBIDDEN_EVENT_KEYS = [
  'content',
  'plaintext',
  'ciphertext',
  'encryptedContent',
  'messageBody',
  'chatContent',
  'body',
  'text',
  'privateKey',
  'secretKey',
  'encryptionKey',
  'keys',
  'payload',
];

export const METRIC_DEFINITIONS = {
  deliveryRatio:
    'Successful destination deliveries / Total attempted trials × 100. Intermediate relay reception is not a destination delivery.',
  averageLatency:
    'Mean of successful destination-delivery latencies only. Unreliable or missing latencies are excluded, never filled with zero.',
  medianLatency:
    'Median of successful destination-delivery latencies only.',
  averageHopCount:
    'Mean of actual final hop counts recorded at destination reception for successful deliveries.',
  duplicateSuppressionCount:
    'Count of DUPLICATE_DETECTED events for unique (trialId, messageId) pairs that were suppressed rather than displayed again.',
  forwardingAttempts:
    'Count of MESSAGE_FORWARDED plus MESSAGE_TRANSMISSION_ATTEMPTED events.',
  routingOverhead:
    '(MESSAGE_TRANSMISSION_ATTEMPTED + MESSAGE_FORWARDED) / unique successful destination deliveries. Null when there are no successful deliveries. This is an application-specific overhead ratio, not a standardized RFC routing-overhead metric.',
  cloudRelaySuccessRate:
    'Backend-confirmed CLOUD_UPLOAD_SUCCEEDED events / CLOUD_UPLOAD_STARTED events × 100. Relay reception without backend confirmation is not success.',
  failedTrialCount:
    'Trials that were attempted and did not confirm destination delivery, including skipped=false failures. Failed trials are retained.',
  totalTrialCount:
    'All attempted trials (successful + failed). Skipped scenarios are counted separately and are not attempted trials.',
};

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
