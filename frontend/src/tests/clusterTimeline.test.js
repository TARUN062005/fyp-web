import { describe, it, expect } from 'vitest';
import { buildClusterTimelineEvents } from '../components/clusters/ClusterTimeline.jsx';

describe('cluster timeline (F5 data only)', () => {
  it('orders first report, escalation, and verification without extra fetches', () => {
    const cluster = {
      clusterId: 'CLUSTER-TL1',
      status: 'verified',
      severity: 'HIGH',
      lastReportAt: '2026-07-31T12:00:00.000Z',
    };
    const reports = [
      {
        id: '2',
        messageId: 'm-high',
        severity: 'HIGH',
        timestamp: '2026-07-31T11:00:00.000Z',
        originalSenderId: 's2',
        uploaderId: 'u2',
      },
      {
        id: '1',
        messageId: 'm-low',
        severity: 'LOW',
        timestamp: '2026-07-31T10:00:00.000Z',
        originalSenderId: 's1',
        uploaderId: 'u1',
      },
    ];

    const events = buildClusterTimelineEvents(cluster, reports);
    expect(events.map((e) => e.kind)).toEqual([
      'first_report',
      'report',
      'escalation',
      'verified',
    ]);
    expect(events[0].detail).toBe('m-low');
    expect(events[2].severity).toBe('HIGH');
  });
});
