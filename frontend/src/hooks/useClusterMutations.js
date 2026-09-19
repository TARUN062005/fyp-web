import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  clustersQueryKey,
  deleteClusters,
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
    mutationFn: (input) => mergeClusters(input),
    onSuccess: (data) => {
      patchAllClusterCaches(
        queryClient,
        AdminSocketEvents.CLUSTER_MERGED,
        data
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
};

export const useDeleteClusters = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clusterIds) => deleteClusters(clusterIds),
    onSuccess: (data) => {
      (data?.deleted || []).forEach((row) => {
        patchAllClusterCaches(
          queryClient,
          AdminSocketEvents.CLUSTER_DELETED,
          row
        );
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    },
  });
};
