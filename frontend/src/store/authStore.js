import { create } from 'zustand';

/**
 * In-memory admin session only (no localStorage).
 * Backend returns JWTs in JSON today — not httpOnly cookies — so we keep
 * tokens in memory and rely on silent refresh to survive access-token expiry
 * within the tab lifetime. A full page reload requires signing in again.
 */
export const useAuthStore = create((set, get) => ({
  accessToken: null,
  refreshToken: null,
  admin: null,

  setSession: ({ accessToken, refreshToken, admin }) => {
    set({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? get().refreshToken,
      admin: admin ?? get().admin,
    });
  },

  setTokens: ({ accessToken, refreshToken }) => {
    set({
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? get().refreshToken,
    });
  },

  clearSession: () => {
    set({ accessToken: null, refreshToken: null, admin: null });
  },

  logout: () => {
    get().clearSession();
  },
}));

export const selectIsAuthenticated = (state) => Boolean(state.accessToken);
