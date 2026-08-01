import { SeverityBadge } from '../ui/AdminState.jsx';

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

const ClusterReportsTable = ({ reports, isLoading, isError, error }) => {
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-xs">
        <thead>
          <tr className="border-b border-admin-line text-admin-muted">
            <th className="px-3 py-2 font-medium">Message</th>
            <th className="px-3 py-2 font-medium">Original sender</th>
            <th className="px-3 py-2 font-medium">Uploader</th>
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">Severity</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-b border-admin-line/70">
              <td className="px-3 py-2 font-mono text-admin-ink">
                {r.messageId}
              </td>
              <td className="px-3 py-2 font-mono" title={r.originalSenderId}>
                {shortId(r.originalSenderId)}
              </td>
              <td className="px-3 py-2 font-mono" title={r.uploaderId}>
                {shortId(r.uploaderId)}
              </td>
              <td className="px-3 py-2 font-mono">{fmt(r.timestamp)}</td>
              <td className="px-3 py-2">
                <SeverityBadge severity={r.severity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClusterReportsTable;
