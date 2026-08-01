/**
 * Shared severity palette for the admin panel.
 * Colors live in CSS (`--severity-*`); shapes/letters accompany color so
 * status is never color-only (color-vision deficiency friendly).
 */

export const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/** Letter marks shown next to color swatches (not color-alone). */
export const SEVERITY_MARK = {
  LOW: 'L',
  MEDIUM: 'M',
  HIGH: 'H',
  CRITICAL: 'C',
};

const FALLBACK = {
  LOW: '#2F6FED',
  MEDIUM: '#B8860B',
  HIGH: '#D94801',
  CRITICAL: '#9B1C1C',
};

export const normalizeSeverity = (severity) => {
  const key = String(severity || '')
    .trim()
    .toUpperCase();
  return SEVERITY_LEVELS.includes(key) ? key : 'MEDIUM';
};

/** Resolve marker/fill color from theme CSS variables when available. */
export const getSeverityColor = (severity) => {
  const level = normalizeSeverity(severity);
  if (typeof document !== 'undefined') {
    const varName = `--severity-${level.toLowerCase()}`;
    const fromCss = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    if (fromCss) return fromCss;
  }
  return FALLBACK[level];
};

export const getSeverityLabel = (severity) => normalizeSeverity(severity);

export const getSeverityMark = (severity) =>
  SEVERITY_MARK[normalizeSeverity(severity)];
