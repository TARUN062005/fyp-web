import { useQuery } from '@tanstack/react-query';
import {
  DASHBOARD_SUMMARY_QUERY_KEY,
  fetchDashboardSummary,
} from '../services/dashboardService.js';

export const useDashboardSummary = () =>
  useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY,
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });
