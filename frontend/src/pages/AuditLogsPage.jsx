import { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs.js';
import { ErrorAlert } from '../components/ui/AdminState.jsx';

const KNOWN_ACTIONS = [
  'user.block',
  'user.unblock',
  'cluster.verify',
  'cluster.merge',
];

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const AuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');

  const { data, isLoading, isError, error, isFetching } = useAuditLogs({
    page,
    limit: 25,
    action: action || undefined,
    adminId: adminId || undefined,
  });

  const logs = data?.logs ?? [];
  const totalPages = data?.totalPages ?? 1;
  const actionOptions = Array.from(
    new Set([...(data?.filterOptions?.actions || []), ...KNOWN_ACTIONS])
  ).sort();
  const adminOptions = data?.filterOptions?.admins || [];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Audit logs</h2>
          <p className="admin-page-sub">
            Chronological trail of admin mutations — read-only.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          {isLoading && !data
            ? 'loading…'
            : `${data?.total ?? 0} entr${data?.total === 1 ? 'y' : 'ies'}`}
          {isFetching && data ? ' · updating' : ''}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-b border-admin-line pb-3">
        <label className="block text-xs font-medium text-admin-muted">
          Action type
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="admin-input mt-1 min-w-[12rem]"
          >
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-admin-muted">
          Admin
          <select
            value={adminId}
            onChange={(e) => {
              setAdminId(e.target.value);
              setPage(1);
            }}
            className="admin-input mt-1 min-w-[14rem]"
          >
            <option value="">All admins</option>
            {adminOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.email}
              </option>
            ))}
          </select>
        </label>

        {action || adminId ? (
          <button
            type="button"
            onClick={() => {
              setAction('');
              setAdminId('');
              setPage(1);
            }}
            className="admin-btn"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load audit logs" />
      ) : null}

      <div className="admin-table-wrap mt-4">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Admin</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Target</th>
              <th className="px-3 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !logs.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-admin-muted">
                  Loading audit logs…
                </td>
              </tr>
            ) : null}

            {!isLoading && !logs.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-admin-muted">
                  No audit entries match this filter.
                </td>
              </tr>
            ) : null}

            {logs.map((log) => (
              <tr
                key={log.id}
                className="border-b border-admin-line/80 hover:bg-white/50"
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {fmt(log.timestamp)}
                </td>
                <td className="px-3 py-2">
                  <p className="text-sm text-admin-ink">
                    {log.adminEmail || '—'}
                  </p>
                  <p className="font-mono text-[10px] text-admin-muted">
                    {log.adminId}
                  </p>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{log.action}</td>
                <td className="px-3 py-2">
                  <p className="text-xs text-admin-muted">{log.targetType}</p>
                  <p className="font-mono text-xs text-admin-ink">
                    {log.targetId}
                  </p>
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-admin-muted">
                  {log.metadata
                    ? JSON.stringify(log.metadata)
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-admin-muted">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-admin-line bg-white px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono">
            page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-admin-line bg-white px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
};

export default AuditLogsPage;
