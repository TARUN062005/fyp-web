import { useQuery } from '@tanstack/react-query';
import { devicesQueryKey, fetchDevices } from '../services/deviceService.js';

export const useDevices = (params) =>
  useQuery({
    queryKey: devicesQueryKey(params),
    queryFn: () => fetchDevices(params),
    staleTime: 15_000,
    placeholderData: (prev) => prev,
  });
