import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getEnv } from '../utils/env.js';
import { useAuthStore } from '../store/authStore.js';
import { DASHBOARD_SUMMARY_QUERY_KEY } from '../services/dashboardService.js';
import { clustersQueryKey } from '../services/clusterService.js';
import { radarGatewaysQueryKey } from '../services/radarService.js';
import {
  AdminSocketEvents,
  applyDashboardSocketEvent,
} from './dashboardSocketPatches.js';
import { applyClustersSocketEvent } from './clusterSocketPatches.js';
import { RadarSocketEvents } from '../radar/radarModel.js';

const CLUSTER_CACHE_KEYS = [
  clustersQueryKey({ includeResolved: false }),
  clustersQueryKey({ includeResolved: true }),
];

const AdminSocketContext = createContext({
  connected: false,
  connectionKey: 0,
  subscribeRadar: () => {},
  unsubscribeRadar: () => {},
  getSocket: () => null,
});

export const useAdminSocketApi = () => useContext(AdminSocketContext);

/**
 * Single admin Socket.IO connection. Dashboard patches stay on this socket;
 * Live Radar subscribe/unsubscribe uses the same connection.
 */
const useAdminSocketController = (enabled = true) => {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const socketRef = useRef(null);
  const subscribedRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [connectionKey, setConnectionKey] = useState(0);

  useEffect(() => {
    if (!enabled || !accessToken) {
      setConnected(false);
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
      if (
        event === AdminSocketEvents.REPORT_CREATED ||
        event === AdminSocketEvents.REPORT_UPDATED ||
        event === AdminSocketEvents.REPORT_CONSENSUS ||
        event === AdminSocketEvents.REPORT_DELETED
      ) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
      }
      if (
        event === AdminSocketEvents.USER_BLOCKED ||
        event === AdminSocketEvents.USER_UNBLOCKED ||
        event === AdminSocketEvents.USER_CREATED ||
        event === AdminSocketEvents.DEVICE_STATUS
      ) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      }
    };

    Object.values(AdminSocketEvents).forEach((event) => {
      socket.on(event, onEvent(event));
    });

    socket.on(RadarSocketEvents.GATEWAY_STATUS, () => {
      queryClient.invalidateQueries({ queryKey: radarGatewaysQueryKey });
    });

    let initialConnect = true;
    socket.on('connect', () => {
      setConnected(true);
      setConnectionKey((n) => n + 1);
      if (subscribedRef.current) {
        socket.emit(RadarSocketEvents.SUBSCRIBE, {
          gatewayUserId: subscribedRef.current,
        });
      }
      if (initialConnect) {
        initialConnect = false;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken, enabled, queryClient]);

  const subscribeRadar = useCallback((gatewayUserId) => {
    subscribedRef.current = gatewayUserId || null;
    if (gatewayUserId) {
      socketRef.current?.emit(RadarSocketEvents.SUBSCRIBE, { gatewayUserId });
    }
  }, []);

  const unsubscribeRadar = useCallback((gatewayUserId) => {
    const id = gatewayUserId || subscribedRef.current;
    if (id) {
      socketRef.current?.emit(RadarSocketEvents.UNSUBSCRIBE, {
        gatewayUserId: id,
      });
    }
    if (!gatewayUserId || gatewayUserId === subscribedRef.current) {
      subscribedRef.current = null;
    }
  }, []);

  const getSocket = useCallback(() => socketRef.current, []);

  return useMemo(
    () => ({
      connected,
      connectionKey,
      subscribeRadar,
      unsubscribeRadar,
      getSocket,
    }),
    [connected, connectionKey, subscribeRadar, unsubscribeRadar, getSocket]
  );
};

export const AdminSocketProvider = ({ children }) => {
  const value = useAdminSocketController(true);
  return createElement(AdminSocketContext.Provider, { value }, children);
};

/** @deprecated Use AdminSocketProvider — kept for any remaining direct callers. */
export const useAdminSocket = (enabled = true) => {
  useAdminSocketController(enabled);
};
