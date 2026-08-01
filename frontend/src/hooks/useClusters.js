import { useQuery } from '@tanstack/react-query';
import {
  clustersQueryKey,
  fetchClusters,
} from '../services/clusterService.js';

/** Active clusters for the map (unverified + verified). */
export const useClusters = () =>
  useQuery({
    queryKey: clustersQueryKey({ includeResolved: false }),
    queryFn: () => fetchClusters({ includeResolved: false }),
    staleTime: 30_000,
  });

/** Ops list including resolved. */
export const useClustersList = () =>
  useQuery({
    queryKey: clustersQueryKey({ includeResolved: true }),
    queryFn: () => fetchClusters({ includeResolved: true }),
    staleTime: 30_000,
  });
