import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getEnv } from '../utils/env.js';
import { useAuthStore } from '../store/authStore.js';
import { DASHBOARD_SUMMARY_QUERY_KEY } from '../services/dashboardService.js';
import { clustersQueryKey } from '../services/clusterService.js';
import {
  AdminSocketEvents,
  applyDashboardSocketEvent,
} from './dashboardSocketPatches.js';
import { applyClustersSocketEvent } from './clusterSocketPatches.js';

const CLUSTER_CACHE_KEYS = [
  clustersQueryKey({ includeResolved: false }),
  clustersQueryKey({ includeResolved: true }),
];

/**
 * Single admin Socket.IO connection: patches dashboard counters and
 * the active-clusters cache (map markers) without full refetch.
 */
export const useAdminSocket = (enabled = true) => {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      return undefined;
    }

    const socket = io(`${getEnv().socketUrl}/admin`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: true,
    });
    socketRef.current = socket;

    const onEvent = (event) => (payload) => {
      queryClient.setQueryData(DASHBOARD_SUMMARY_QUERY_KEY, (prev) =>
        applyDashboardSocketEvent(prev, event, payload)
      );
      CLUSTER_CACHE_KEYS.forEach((key) => {
        queryClient.setQueryData(key, (prev) =>
          applyClustersSocketEvent(prev, event, payload)
        );
      });
    };

    Object.values(AdminSocketEvents).forEach((event) => {
      socket.on(event, onEvent(event));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, enabled, queryClient]);
};
