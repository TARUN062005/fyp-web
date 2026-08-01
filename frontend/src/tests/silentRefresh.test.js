import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiClient } from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

describe('silent access-token refresh', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
      admin: { email: 'admin@test.local', role: 'admin' },
    });
  });

  it('refreshes transparently on 401 and retries without clearing the session', async () => {
    let meAttempts = 0;
    const refreshPost = vi.fn(async () => ({
      data: {
        data: {
          accessToken: 'fresh-access-token',
          refreshToken: 'fresh-refresh-token',
        },
      },
    }));

    const adapter = async (config) => {
      const url = config.url || '';
      if (url.includes('/admin/me')) {
        meAttempts += 1;
        const auth = config.headers?.Authorization || '';
        if (meAttempts === 1) {
          const error = new Error('Unauthorized');
          error.config = config;
          error.response = { status: 401, data: { success: false } };
          throw error;
        }
        expect(auth).toBe('Bearer fresh-access-token');
        return {
          data: { success: true, data: { email: 'admin@test.local' } },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    };

    const api = createApiClient({
      baseURL: 'http://admin.test',
      adapter,
      refreshPost,
    });

    const res = await api.get('/admin/me');

    expect(res.status).toBe(200);
    expect(res.data.data.email).toBe('admin@test.local');
    expect(meAttempts).toBe(2);
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(refreshPost.mock.calls[0][0]).toContain('/admin/auth/refresh');
    expect(refreshPost.mock.calls[0][1]).toEqual({
      refreshToken: 'valid-refresh-token',
    });

    const session = useAuthStore.getState();
    expect(session.accessToken).toBe('fresh-access-token');
    expect(session.refreshToken).toBe('fresh-refresh-token');
    expect(session.admin?.email).toBe('admin@test.local');
  });
});
