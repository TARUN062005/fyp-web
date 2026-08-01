import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { logoutAdmin } from '../services/authService.js';
import { useAdminSocket } from '../hooks/useAdminSocket.js';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/map', label: 'Map' },
  { to: '/clusters', label: 'Clusters' },
  { to: '/users', label: 'Users' },
  { to: '/reports', label: 'Reports' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/devices', label: 'Devices' },
  { to: '/audit-logs', label: 'Audit logs' },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const admin = useAuthStore((s) => s.admin);
  useAdminSocket(true);

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // logoutAdmin clears memory even if the network call fails
    }
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-admin-canvas">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-admin-surface focus:px-3 focus:py-2 focus:text-sm focus:text-admin-ink"
      >
        Skip to main content
      </a>

      <aside className="flex w-52 shrink-0 flex-col border-r border-admin-sidebar-muted/30 bg-admin-sidebar text-admin-sidebar-ink lg:w-56">
        <div className="border-b border-admin-sidebar-ink/10 px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-admin-sidebar-muted">
            Ops console
          </p>
          <h1 className="mt-1 text-base font-semibold tracking-tight">
            DTNEmergency
          </h1>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'rounded px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-admin-sidebar-active text-admin-surface'
                    : 'text-admin-sidebar-muted hover:bg-admin-sidebar-ink/5 hover:text-admin-sidebar-ink',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-admin-sidebar-ink/10 p-3 text-xs text-admin-sidebar-muted">
          <p className="truncate font-medium text-admin-sidebar-ink">
            {admin?.email || 'Admin'}
          </p>
          <p className="mt-0.5 font-mono uppercase tracking-wide">
            {admin?.role || 'role'}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-admin-line bg-admin-panel/90 px-5 shadow-admin backdrop-blur">
          <p className="truncate text-sm text-admin-muted">
            Control panel · live incident operations
          </p>
          <button type="button" onClick={handleLogout} className="admin-btn">
            Sign out
          </button>
        </header>

        <main id="admin-main" className="flex-1 overflow-auto p-5 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
