import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReport, deleteReports } from '../services/reportService.js';
import { DASHBOARD_SUMMARY_QUERY_KEY } from '../services/dashboardService.js';
import { clustersQueryKey } from '../services/clusterService.js';

const invalidateReportCaches = (queryClient) => {
  queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
  queryClient.invalidateQueries({
    queryKey: clustersQueryKey({ includeResolved: false }),
  });
  queryClient.invalidateQueries({
    queryKey: clustersQueryKey({ includeResolved: true }),
  });
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportId) => deleteReport(reportId),
    onSuccess: () => invalidateReportCaches(queryClient),
  });
};

export const useDeleteReports = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reportIds) => deleteReports(reportIds),
    onSuccess: () => invalidateReportCaches(queryClient),
  });
};
