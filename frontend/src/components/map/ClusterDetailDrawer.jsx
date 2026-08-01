import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from '../ui/AdminState.jsx';

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const ClusterDetailDrawer = ({ cluster, onClose }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!cluster) return undefined;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cluster, onClose]);

  if (!cluster) return null;

  const confidence =
    typeof cluster.confidenceScore === 'number'
      ? `${Math.round(cluster.confidenceScore * 100)}%`
      : '—';

  return (
    <aside
      className="absolute inset-y-0 right-0 z-[1000] flex w-full max-w-sm flex-col border-l border-admin-line bg-admin-panel shadow-admin"
      role="dialog"
      aria-modal="true"
      aria-label="Cluster details"
    >
      <div className="flex items-start justify-between gap-3 border-b border-admin-line px-4 py-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-admin-muted">
            Cluster
          </p>
          <h3 className="mt-0.5 font-mono text-sm font-semibold text-admin-ink">
            {cluster.clusterId}
          </h3>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="admin-btn"
        >
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-auto px-4 py-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={cluster.severity} />
          <span className="font-mono text-xs uppercase text-admin-muted">
            {cluster.status}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-admin-muted">Type</dt>
          <dd className="text-admin-ink">{cluster.emergencyType || '—'}</dd>
          <dt className="text-admin-muted">Reports</dt>
          <dd className="font-mono text-admin-ink">{cluster.reportCount ?? 0}</dd>
          <dt className="text-admin-muted">Confidence</dt>
          <dd className="font-mono text-admin-ink">{confidence}</dd>
          <dt className="text-admin-muted">First report</dt>
          <dd className="font-mono text-xs text-admin-ink">
            {fmt(cluster.firstReportAt)}
          </dd>
          <dt className="text-admin-muted">Last report</dt>
          <dd className="font-mono text-xs text-admin-ink">
            {fmt(cluster.lastReportAt)}
          </dd>
        </dl>
      </div>

      <div className="border-t border-admin-line px-4 py-3">
        <Link
          to={`/clusters/${encodeURIComponent(cluster.clusterId)}`}
          className="admin-btn-primary inline-flex w-full items-center justify-center"
        >
          Open full cluster detail
        </Link>
      </div>
    </aside>
  );
};

export default ClusterDetailDrawer;
