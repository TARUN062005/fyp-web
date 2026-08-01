/** Canonical enums for emergency report / cluster fields. */

export const SEVERITY_VALUES = Object.freeze([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const EMERGENCY_TYPE_VALUES = Object.freeze([
  'sos',
  'fire',
  'flood',
  'medical',
  'collapse',
  'structural collapse',
  'other',
]);

export const normalizeSeverity = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

export const normalizeEmergencyType = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();
