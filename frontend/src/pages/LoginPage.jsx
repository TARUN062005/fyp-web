import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore.js';
import { loginAdmin } from '../services/authService.js';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from || '/dashboard';

  // Already signed in (in-tab session) — resume the page they wanted.
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await loginAdmin({ email, password });
      // In-memory only — access + refresh tokens never written to localStorage
      setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        admin: data.admin,
      });
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Sign-in failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-admin-canvas px-4">
      <div className="w-full max-w-sm border border-admin-line bg-admin-panel p-6 shadow-admin">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-muted">
          DTNEmergency ops
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-admin-ink">
          Admin sign in
        </h1>
        <p className="admin-page-sub">
          Authorized operators only. No public registration.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-admin-ink">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input rounded px-3 py-2"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-admin-ink">
              Password
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input rounded px-3 py-2"
            />
          </label>

          {error ? (
            <p className="text-sm text-admin-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="admin-btn-primary w-full py-2.5 text-sm font-semibold"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
