import { describe, it, expect } from 'vitest';
import { buildReportParams } from '../services/reportService.js';

describe('report list/export share the same filter params', () => {
  it('includes severity, date range, and complete bounding box', () => {
    const params = buildReportParams({
      page: 2,
      limit: 20,
      severity: 'HIGH',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      minLng: 77,
      minLat: 12,
      maxLng: 78,
      maxLat: 13,
      format: 'csv',
    });

    expect(params).toEqual({
      page: 2,
      limit: 20,
      severity: 'HIGH',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      minLng: 77,
      minLat: 12,
      maxLng: 78,
      maxLat: 13,
      format: 'csv',
    });
  });

  it('omits incomplete bounding boxes so export cannot silently drop geo filter', () => {
    const params = buildReportParams({
      severity: 'MEDIUM',
      minLng: 77,
      minLat: 12,
      // maxLng / maxLat missing
    });
    expect(params.severity).toBe('MEDIUM');
    expect(params.minLng).toBeUndefined();
    expect(params.maxLat).toBeUndefined();
  });
});
