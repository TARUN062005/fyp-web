import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { CLUSTERS_QUERY_KEY } from '../services/clusterService.js';
import { applyClustersSocketEvent } from '../hooks/clusterSocketPatches.js';
import { AdminSocketEvents } from '../hooks/dashboardSocketPatches.js';
import {
  getSeverityColor,
  normalizeSeverity,
} from '../theme/severity.js';

describe('map marker severity live updates', () => {
  beforeEach(() => {
    document.documentElement.style.setProperty('--severity-low', '#2f6fed');
    document.documentElement.style.setProperty('--severity-medium', '#b8860b');
    document.documentElement.style.setProperty('--severity-high', '#d94801');
    document.documentElement.style.setProperty('--severity-critical', '#9b1c1c');
  });

  it('uses theme CSS variables for marker colors', () => {
    expect(getSeverityColor('MEDIUM')).toBe('#b8860b');
    expect(getSeverityColor('HIGH')).toBe('#d94801');
    expect(normalizeSeverity('high')).toBe('HIGH');
  });

  it('updates marker color when cluster:updated escalates severity', () => {
    const client = new QueryClient();
    const baseline = [
      {
        id: 'c1',
        clusterId: 'CLUSTER-ESCALE1',
        emergencyType: 'flood-test',
        severity: 'MEDIUM',
        reportCount: 1,
        confidenceScore: 0.6,
        location: { type: 'Point', coordinates: [77.6, 12.9] },
        status: 'unverified',
      },
    ];
    client.setQueryData(CLUSTERS_QUERY_KEY, baseline);

    const beforeColor = getSeverityColor(
      client.getQueryData(CLUSTERS_QUERY_KEY)[0].severity
    );

    client.setQueryData(CLUSTERS_QUERY_KEY, (prev) =>
      applyClustersSocketEvent(prev, AdminSocketEvents.CLUSTER_UPDATED, {
        cluster: {
          ...baseline[0],
          severity: 'HIGH',
          reportCount: 2,
          confidenceScore: 0.7,
        },
        previous: { reportCount: 1, severity: 'MEDIUM' },
      })
    );

    const updated = client.getQueryData(CLUSTERS_QUERY_KEY)[0];
    const afterColor = getSeverityColor(updated.severity);

    expect(updated.severity).toBe('HIGH');
    expect(updated.reportCount).toBe(2);
    expect(beforeColor).toBe('#b8860b');
    expect(afterColor).toBe('#d94801');
    expect(afterColor).not.toBe(beforeColor);
  });
});
