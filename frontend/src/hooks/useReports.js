import { useQuery } from '@tanstack/react-query';
import {
  buildReportParams,
  fetchReports,
  reportsQueryKey,
} from '../services/reportService.js';

export const useReports = (filters) => {
  const params = buildReportParams(filters);
  return useQuery({
    queryKey: reportsQueryKey(params),
    queryFn: () => fetchReports(filters),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
};
