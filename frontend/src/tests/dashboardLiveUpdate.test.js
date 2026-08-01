import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { DASHBOARD_SUMMARY_QUERY_KEY } from '../services/dashboardService.js';
import {
  AdminSocketEvents,
  applyDashboardSocketEvent,
} from '../hooks/dashboardSocketPatches.js';

describe('dashboard live socket patches (no refetch)', () => {
  it('increments active emergencies + clusters today on cluster:created', () => {
    const before = {
      activeEmergencies: 2,
      clustersToday: 1,
      verifiedUsers: 10,
      blockedUsers: 0,
      devicesOnline: 3,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const after = applyDashboardSocketEvent(
      before,
      AdminSocketEvents.CLUSTER_CREATED
    );

    expect(after.activeEmergencies).toBe(3);
    expect(after.clustersToday).toBe(2);
    expect(after.verifiedUsers).toBe(10);
    expect(after.generatedAt).not.toBe(before.generatedAt);
  });

  it('updates React Query cache via setQueryData without clearing other fields', () => {
    const client = new QueryClient();
    const baseline = {
      activeEmergencies: 0,
      clustersToday: 0,
      verifiedUsers: 5,
      blockedUsers: 1,
      devicesOnline: 2,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    client.setQueryData(DASHBOARD_SUMMARY_QUERY_KEY, baseline);

    client.setQueryData(DASHBOARD_SUMMARY_QUERY_KEY, (prev) =>
      applyDashboardSocketEvent(prev, AdminSocketEvents.CLUSTER_CREATED)
    );

    const cached = client.getQueryData(DASHBOARD_SUMMARY_QUERY_KEY);
    expect(cached.activeEmergencies).toBe(1);
    expect(cached.clustersToday).toBe(1);
    expect(cached.blockedUsers).toBe(1);
    expect(cached.devicesOnline).toBe(2);
  });

  it('report:created / cluster:updated only refresh generatedAt', () => {
    const before = {
      activeEmergencies: 4,
      clustersToday: 2,
      verifiedUsers: 1,
      blockedUsers: 0,
      devicesOnline: 0,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };

    const fromReport = applyDashboardSocketEvent(
      before,
      AdminSocketEvents.REPORT_CREATED
    );
    expect(fromReport.activeEmergencies).toBe(4);
    expect(fromReport.clustersToday).toBe(2);
    expect(fromReport.generatedAt).not.toBe(before.generatedAt);

    const fromUpdate = applyDashboardSocketEvent(
      before,
      AdminSocketEvents.CLUSTER_UPDATED
    );
    expect(fromUpdate.activeEmergencies).toBe(4);
    expect(fromUpdate.clustersToday).toBe(2);
  });
});
