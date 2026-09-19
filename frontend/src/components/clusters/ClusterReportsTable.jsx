import { AlertKindBadge, SeverityBadge } from '../ui/AdminState.jsx';

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const shortId = (id) => {
  if (!id) return '—';
  const s = String(id);
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

const personLabel = (summary, fallbackId) => {
  if (summary?.displayName) {
    const extra = summary.emergencyId ? ` · ${summary.emergencyId}` : '';
    return `${summary.displayName}${extra}`;
  }
  return shortId(summary?.id || fallbackId);
};

const ClusterReportsTable = ({
  reports,
  isLoading,
  isError,
  error,
  onDelete,
  deletingId,
  selectedIds = [],
  onToggleSelect,
  onToggleAll,
  onOpen,
  openId,
}) => {
  if (isLoading) {
    return (
      <p className="px-3 py-2 text-xs text-admin-muted" aria-live="polite">
        Loading reports…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="px-3 py-2 text-xs text-admin-danger" role="alert">
        {error?.response?.data?.error?.message ||
          error?.message ||
          'Failed to load reports'}
      </p>
    );
  }

  if (!reports?.length) {
    return (
      <p className="px-3 py-2 text-xs text-admin-muted">
        No reports linked to this cluster.
      </p>
    );
  }

  const allSelected =
    reports.length > 0 && reports.every((r) => selectedIds.includes(r.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-xs">
        <thead>
          <tr className="border-b border-admin-line text-admin-muted">
            {onToggleSelect ? (
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all reports in this cluster"
                />
              </th>
            ) : null}
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Original sender</th>
            <th className="px-3 py-2 font-medium">Uploader</th>
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">Severity</th>
            {onDelete ? (
              <th className="px-3 py-2 font-medium">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const open = openId === r.id;
            return (
              <tr
                key={r.id}
                className={[
                  'border-b border-admin-line/70',
                  onOpen ? 'cursor-pointer hover:bg-admin-surface/80' : '',
                  open ? 'bg-admin-accent-soft/40' : '',
                ].join(' ')}
                onClick={() => onOpen?.(r)}
              >
                {onToggleSelect ? (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => onToggleSelect(r.id)}
                      aria-label={`Select ${r.messageId}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  <AlertKindBadge emergencyType={r.emergencyType} />
                </td>
                <td className="px-3 py-2 capitalize">{r.emergencyType || '—'}</td>
                <td className="px-3 py-2" title={r.originalSenderId}>
                  {personLabel(r.originalSender, r.originalSenderId)}
                </td>
                <td className="px-3 py-2" title={r.uploaderId}>
                  {personLabel(r.receivedBy, r.uploaderId)}
                </td>
                <td className="px-3 py-2 font-mono">{fmt(r.timestamp)}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={r.severity} />
                </td>
                {onDelete ? (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin-btn-danger px-2 py-1"
                      disabled={Boolean(deletingId)}
                      onClick={() => onDelete(r)}
                    >
                      {deletingId === r.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ClusterReportsTable;
