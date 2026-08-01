import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clustersQueryKey,
  mergeClusters,
  verifyCluster,
} from '../services/clusterService.js';
import { applyClustersSocketEvent } from './clusterSocketPatches.js';
import { AdminSocketEvents } from './dashboardSocketPatches.js';

const patchAllClusterCaches = (queryClient, event, payload) => {
  [
    clustersQueryKey({ includeResolved: false }),
    clustersQueryKey({ includeResolved: true }),
  ].forEach((key) => {
    queryClient.setQueryData(key, (prev) =>
      applyClustersSocketEvent(prev, event, payload)
    );
  });
};

export const useVerifyCluster = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clusterId) => verifyCluster(clusterId),
    onSuccess: (data) => {
      // Immediate cache patch (socket also emits cluster:verified)
      patchAllClusterCaches(
        queryClient,
        AdminSocketEvents.CLUSTER_VERIFIED,
        data
      );
    },
  });
};

export const useMergeClusters = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sourceClusterId, targetClusterId }) =>
      mergeClusters({ sourceClusterId, targetClusterId }),
    onSuccess: (data) => {
      patchAllClusterCaches(
        queryClient,
        AdminSocketEvents.CLUSTER_MERGED,
        data
      );
    },
  });
};
