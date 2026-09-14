import * as authApi from '../services/authService.js';
import { readStoredSession, useAuthStore } from '../store/authStore.js';

/**
 * Restore a tab session after refresh, then validate with GET /admin/me
 * (silent refresh interceptor handles an expired access token).
 */
export const hydrateAdminSession = async () => {
  const store = useAuthStore.getState();
  store.setStatus('hydrating');

  const stored = readStoredSession();
  if (!stored?.accessToken && !stored?.refreshToken) {
    store.setStatus('ready');
    return;
  }

  store.setSession(stored);

  try {
    const admin = await authApi.fetchAdminMe();
    useAuthStore.getState().setSession({ admin });
  } catch {
    useAuthStore.getState().clearSession();
  }

  useAuthStore.getState().setStatus('ready');
};
