import { useMutation, useQueryClient } from '@tanstack/react-query';
import { blockUser, unblockUser } from '../services/userService.js';
import { DASHBOARD_SUMMARY_QUERY_KEY } from '../services/dashboardService.js';

export const useBlockUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }) => blockUser({ userId, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
    },
  });
};

export const useUnblockUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId }) => unblockUser({ userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY });
    },
  });
};
