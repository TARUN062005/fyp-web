import axios from 'axios';
import { getEnv } from '../utils/env.js';
import { useAuthStore } from '../store/authStore.js';

const AUTH_SKIP_REFRESH = new Set([
  '/admin/auth/login',
  '/admin/auth/refresh',
  '/admin/auth/logout',
]);

export const shouldSkipRefresh = (config) => {
  const url = config?.url || '';
  return [...AUTH_SKIP_REFRESH].some((path) => url.includes(path));
};

/**
 * Factory so tests can inject baseURL / adapter / expiry handler.
 */
export const createApiClient = ({
  baseURL = getEnv().apiUrl,
  adapter,
  onSessionExpired,
  refreshPost = axios.post.bind(axios),
} = {}) => {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    ...(adapter ? { adapter } : {}),
  });

  let refreshPromise = null;

  const redirectToLogin = () => {
    useAuthStore.getState().clearSession();
    if (typeof onSessionExpired === 'function') {
      onSessionExpired();
    } else if (
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      window.location.assign('/login');
    }
  };

  const silentRefresh = async () => {
    const { refreshToken, setTokens, clearSession } = useAuthStore.getState();
    if (!refreshToken) {
      clearSession();
      throw new Error('No refresh token');
    }

    const { data } = await refreshPost(
      `${baseURL}/admin/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const next = data?.data;
    if (!next?.accessToken || !next?.refreshToken) {
      clearSession();
      throw new Error('Invalid refresh response');
    }

    setTokens({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    });

    return next.accessToken;
  };

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;

      if (
        status !== 401 ||
        !original ||
        original._retry ||
        shouldSkipRefresh(original)
      ) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = silentRefresh().finally(() => {
            refreshPromise = null;
          });
        }

        const accessToken = await refreshPromise;
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return client(original);
      } catch {
        redirectToLogin();
        return Promise.reject(error);
      }
    }
  );

  return client;
};

const api = createApiClient();

export default api;
