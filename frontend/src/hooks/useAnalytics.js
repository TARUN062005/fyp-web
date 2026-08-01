import { useQuery } from '@tanstack/react-query';
import {
  analyticsQueryKey,
  fetchAnalytics,
} from '../services/analyticsService.js';

export const useAnalytics = (days = 14) =>
  useQuery({
    queryKey: analyticsQueryKey(days),
    queryFn: () => fetchAnalytics(days),
    staleTime: 60_000,
  });
