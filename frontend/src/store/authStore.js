import { create } from 'zustand';

const STORAGE_KEY = 'dtnemergency.admin.session';

const readStoredSession = () => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.accessToken && !parsed?.refreshToken) return null;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      admin: parsed.admin ?? null,
    };
  } catch {
    return null;
  }
};

const writeStoredSession = ({ accessToken, refreshToken, admin }) => {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (!accessToken && !refreshToken) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: accessToken ?? null,
        refreshToken: refreshToken ?? null,
        admin: admin ?? null,
      })
    );
  } catch {
    /* private mode / blocked storage */
  }
};

/**
 * Admin session. Tokens stay in tab-scoped sessionStorage (survives refresh,
 * cleared when the tab is closed — same as the previous in-memory close policy).
 * Never uses localStorage. Mobile JWTs are not stored here.
 *
 * `status`:
 * - hydrating — bootstrap in progress; do not redirect yet
 * - ready — hydration finished (authenticated or not)
 */
export const useAuthStore = create((set, get) => ({
  status: 'ready',
  accessToken: null,
  refreshToken: null,
  admin: null,

  setStatus: (status) => set({ status }),

  setSession: ({ accessToken, refreshToken, admin } = {}) => {
    const current = get();
    const next = {
      accessToken: accessToken !== undefined ? accessToken : current.accessToken,
      refreshToken: refreshToken !== undefined ? refreshToken : current.refreshToken,
      admin: admin !== undefined ? admin : current.admin,
    };
    writeStoredSession(next);
    set(next);
  },

  setTokens: ({ accessToken, refreshToken }) => {
    const next = {
      accessToken: accessToken ?? null,
      refreshToken: refreshToken ?? get().refreshToken,
      admin: get().admin,
    };
    writeStoredSession(next);
    set({
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
    });
  },

  clearSession: () => {
    writeStoredSession({
      accessToken: null,
      refreshToken: null,
      admin: null,
    });
    set({ accessToken: null, refreshToken: null, admin: null });
  },

  logout: () => {
    get().clearSession();
  },
}));

export const selectIsAuthenticated = (state) => Boolean(state.accessToken);

export const selectAuthStatus = (state) => state.status;

export { STORAGE_KEY, readStoredSession };
