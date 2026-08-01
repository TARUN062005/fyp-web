import { useQuery } from '@tanstack/react-query';
import { fetchUsers, usersQueryKey } from '../services/userService.js';

export const useUsers = ({ filter = 'all', q = '', page = 1, limit = 50 } = {}) =>
  useQuery({
    queryKey: usersQueryKey({ filter, q, page, limit }),
    queryFn: () => fetchUsers({ filter, q, page, limit }),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
