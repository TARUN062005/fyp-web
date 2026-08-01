import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { useAuthStore } from '../store/authStore.js';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      admin: null,
    });
  });

  it('redirects unauthenticated users from a protected route to /login', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard screen')).not.toBeInTheDocument();
  });

  it('allows authenticated users to reach the protected route', () => {
    useAuthStore.setState({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      admin: { email: 'admin@test.local', role: 'admin' },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login screen</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard screen</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(container).toHaveTextContent('Dashboard screen');
    expect(container).not.toHaveTextContent('Login screen');
  });
});
