import { describe, it, expect } from 'vitest';
import { AdminSocketEvents } from '../hooks/dashboardSocketPatches.js';
import { applyClustersSocketEvent } from '../hooks/clusterSocketPatches.js';

describe('cluster socket patches', () => {
  const clusters = [
    { id: '1', clusterId: 'CLUSTER-AAA1', reportCount: 2 },
    { id: '2', clusterId: 'CLUSTER-BBB2', reportCount: 1 },
  ];

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
