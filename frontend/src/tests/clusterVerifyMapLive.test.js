import { describe, it, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { clustersQueryKey } from '../services/clusterService.js';
import { applyClustersSocketEvent } from '../hooks/clusterSocketPatches.js';
import { AdminSocketEvents } from '../hooks/dashboardSocketPatches.js';

describe('verify cluster → map cache status (no refetch)', () => {
  it('cluster:verified patches active map cache to verified', () => {
    const client = new QueryClient();
    const mapKey = clustersQueryKey({ includeResolved: false });
    const listKey = clustersQueryKey({ includeResolved: true });

    const baseline = [
      {
        id: 'c1',
        clusterId: 'CLUSTER-VERIFY1',
        severity: 'HIGH',
        reportCount: 3,
        status: 'unverified',
        location: { type: 'Point', coordinates: [77.6, 12.9] },
      },
    ];
    client.setQueryData(mapKey, baseline);
    client.setQueryData(listKey, baseline);

    const payload = {
      cluster: {
        id: 'c1',
        clusterId: 'CLUSTER-VERIFY1',
        status: 'verified',
        severity: 'HIGH',
        reportCount: 3,
      },
    };

    // Same path as useVerifyCluster onSuccess + useAdminSocket
    [mapKey, listKey].forEach((key) => {
      client.setQueryData(key, (prev) =>
        applyClustersSocketEvent(
          prev,
          AdminSocketEvents.CLUSTER_VERIFIED,
          payload
        )
      );
    });

    expect(client.getQueryData(mapKey)[0].status).toBe('verified');
    expect(client.getQueryData(listKey)[0].status).toBe('verified');
  });
});
