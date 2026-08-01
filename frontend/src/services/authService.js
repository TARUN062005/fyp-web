import api from './api.js';
import { useAuthStore } from '../store/authStore.js';

export const loginAdmin = async ({ email, password }) => {
  const { data } = await api.post('/admin/auth/login', { email, password });
  return data.data;
};

export const refreshAdminSession = async (refreshToken) => {
  const { data } = await api.post('/admin/auth/refresh', { refreshToken });
  return data.data;
};

/**
 * Clears server-side refresh token, then wipes in-memory session.
 */
export const logoutAdmin = async () => {
  const { refreshToken, clearSession } = useAuthStore.getState();
  try {
    if (refreshToken) {
      await api.post('/admin/auth/logout', { refreshToken });
    }
  } finally {
    clearSession();
  }
};
