import { useQuery } from '@tanstack/react-query';
import {
  clusterReportsQueryKey,
  fetchClusterReports,
} from '../services/reportService.js';

export const useClusterReports = (clusterId, enabled = true) =>
  useQuery({
    queryKey: clusterReportsQueryKey(clusterId),
    queryFn: () => fetchClusterReports(clusterId),
    enabled: Boolean(enabled && clusterId),
    staleTime: 15_000,
  });
