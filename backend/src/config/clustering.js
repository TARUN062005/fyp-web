/**
 * Tunable clustering / severity parameters.
 * Adjust weights here without rewriting the clustering flow.
 */

/** Meters — reports/clusters within this radius may merge. */
export const CLUSTER_RADIUS_METERS =
  Number(process.env.CLUSTER_RADIUS_METERS) || 500;

/** ms — cluster lastReportAt must fall within this window of the new report. */
export const CLUSTER_TIME_WINDOW_MS =
  Number(process.env.CLUSTER_TIME_WINDOW_MS) || 2 * 60 * 60 * 1000;

export const SEVERITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const RANK_TO_SEVERITY = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
};

/**
 * Per-emergencyType escalation profile for computeClusterSeverity.
 *
 * - countWeight / confidenceWeight / typeBias: relative contribution to the
 *   escalation score (they need not sum to 1; the score is clamped later).
 * - typeBias: built-in push toward higher severity for dangerous types
 *   (fire, collapse, sos) even at modest corroboration.
 */
export const EMERGENCY_TYPE_SEVERITY_PROFILES = {
  sos: {
    countWeight: 0.2,
    confidenceWeight: 0.35,
    typeBias: 0.45,
  },
  fire: {
    countWeight: 0.25,
    confidenceWeight: 0.35,
    typeBias: 0.4,
  },
  'structural collapse': {
    countWeight: 0.25,
    confidenceWeight: 0.35,
    typeBias: 0.4,
  },
  collapse: {
    countWeight: 0.25,
    confidenceWeight: 0.35,
    typeBias: 0.4,
  },
  flood: {
    countWeight: 0.35,
    confidenceWeight: 0.4,
    typeBias: 0.15,
  },
  medical: {
    countWeight: 0.3,
    confidenceWeight: 0.4,
    typeBias: 0.25,
  },
  default: {
    countWeight: 0.35,
    confidenceWeight: 0.45,
    typeBias: 0.1,
  },
};

export const getSeverityProfile = (emergencyType) => {
  const key = String(emergencyType || '')
    .trim()
    .toLowerCase();
  return (
    EMERGENCY_TYPE_SEVERITY_PROFILES[key] ||
    EMERGENCY_TYPE_SEVERITY_PROFILES.default
  );
};
