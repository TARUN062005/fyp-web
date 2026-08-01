import { useQuery } from '@tanstack/react-query';
import {
  auditLogsQueryKey,
  fetchAuditLogs,
} from '../services/auditService.js';

export const useAuditLogs = (params) =>
  useQuery({
    queryKey: auditLogsQueryKey(params),
    queryFn: () => fetchAuditLogs(params),
    staleTime: 10_000,
    placeholderData: (prev) => prev,
  });
