import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  useAuthStore,
  selectAuthStatus,
  selectIsAuthenticated,
} from '../store/authStore.js';
import { LoadingNotice } from './ui/AdminState.jsx';

/**
 * Protects admin routes.
 * While session hydration runs, render a loading state — never /login —
 * so a refresh cannot race an empty in-memory store.
 */
const ProtectedRoute = () => {
  const status = useAuthStore(selectAuthStatus);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const location = useLocation();

  if (status === 'hydrating') {
    return <LoadingNotice>Restoring session…</LoadingNotice>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
