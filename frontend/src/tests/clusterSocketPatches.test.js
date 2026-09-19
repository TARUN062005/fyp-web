import { describe, it, expect } from 'vitest';
import { AdminSocketEvents } from '../hooks/dashboardSocketPatches.js';
import { applyClustersSocketEvent } from '../hooks/clusterSocketPatches.js';

describe('cluster socket patches', () => {
  const clusters = [
    { id: '1', clusterId: 'CLUSTER-AAA1', reportCount: 2 },
    { id: '2', clusterId: 'CLUSTER-BBB2', reportCount: 1 },
  ];

  it('patches survivor and drops source on cluster:merged', () => {
    const next = applyClustersSocketEvent(
      clusters,
      AdminSocketEvents.CLUSTER_MERGED,
      {
        cluster: { id: '1', clusterId: 'CLUSTER-AAA1', reportCount: 3 },
        mergedAwayClusterId: 'CLUSTER-BBB2',
      }
    );
    expect(next).toHaveLength(1);
    expect(next[0].reportCount).toBe(3);
  });

  it('removes every merged-away cluster id', () => {
    const next = applyClustersSocketEvent(
      [
        { id: '1', clusterId: 'CLUSTER-KEEP', reportCount: 4 },
        { id: '2', clusterId: 'CLUSTER-A', reportCount: 1 },
        { id: '3', clusterId: 'CLUSTER-B', reportCount: 1 },
      ],
      AdminSocketEvents.CLUSTER_MERGED,
      {
        cluster: { id: '1', clusterId: 'CLUSTER-KEEP', reportCount: 6 },
        mergedAwayClusterIds: ['CLUSTER-A', 'CLUSTER-B'],
        mergedAwayClusterId: 'CLUSTER-B',
      }
    );
    expect(next.map((c) => c.clusterId)).toEqual(['CLUSTER-KEEP']);
    expect(next[0].reportCount).toBe(6);
  });

  it('removes a cluster on cluster:deleted', () => {
    const next = applyClustersSocketEvent(
      clusters,
      AdminSocketEvents.CLUSTER_DELETED,
      { clusterId: 'CLUSTER-AAA1', id: '1' }
    );
    expect(next).toHaveLength(1);
    expect(next[0].clusterId).toBe('CLUSTER-BBB2');
  });
});
