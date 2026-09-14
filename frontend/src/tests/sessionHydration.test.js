import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { hydrateAdminSession } from '../auth/hydrateAdminSession.js';
import { STORAGE_KEY, useAuthStore } from '../store/authStore.js';
import * as authService from '../services/authService.js';

describe('hydrateAdminSession', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useAuthStore.setState({
      status: 'ready',
      accessToken: null,
      refreshToken: null,
      admin: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('stays unauthenticated when nothing is stored', async () => {
    await hydrateAdminSession();
    const state = useAuthStore.getState();
    expect(state.status).toBe('ready');
    expect(state.accessToken).toBeNull();
  });

  it('restores a stored session after GET /admin/me succeeds', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'stored-access',
        refreshToken: 'stored-refresh',
        admin: { email: 'old@test.local', role: 'admin' },
      })
    );
    vi.spyOn(authService, 'fetchAdminMe').mockResolvedValue({
      email: 'admin@test.local',
      role: 'admin',
    });

    await hydrateAdminSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('ready');
    expect(state.accessToken).toBe('stored-access');
    expect(state.refreshToken).toBe('stored-refresh');
    expect(state.admin.email).toBe('admin@test.local');
  });

  it('clears the session when /admin/me fails', async () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: 'dead-access',
        refreshToken: 'dead-refresh',
        admin: { email: 'admin@test.local', role: 'admin' },
      })
    );
    vi.spyOn(authService, 'fetchAdminMe').mockRejectedValue(new Error('unauthorized'));

    await hydrateAdminSession();

    const state = useAuthStore.getState();
    expect(state.status).toBe('ready');
    expect(state.accessToken).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('writes tokens to sessionStorage on setSession', () => {
    useAuthStore.getState().setSession({
      accessToken: 'a',
      refreshToken: 'r',
      admin: { email: 'a@b.c', role: 'admin' },
    });
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    expect(stored.accessToken).toBe('a');
    expect(stored.refreshToken).toBe('r');
    expect(stored.admin.email).toBe('a@b.c');
  });

  it('keeps tokens when setSession updates only admin', () => {
    useAuthStore.getState().setSession({
      accessToken: 'stored-access',
      refreshToken: 'stored-refresh',
      admin: { email: 'old@test.local', role: 'admin' },
    });
    useAuthStore.getState().setSession({
      admin: { email: 'admin@test.local', role: 'admin' },
    });
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('stored-access');
    expect(state.refreshToken).toBe('stored-refresh');
    expect(state.admin.email).toBe('admin@test.local');
  });
});
