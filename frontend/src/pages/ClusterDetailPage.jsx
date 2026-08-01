import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useClustersList } from '../hooks/useClusters.js';
import { useClusterReports } from '../hooks/useClusterReports.js';
import { useVerifyCluster } from '../hooks/useClusterMutations.js';
import ClusterTimeline from '../components/clusters/ClusterTimeline.jsx';
import {
  ErrorAlert,
  LoadingNotice,
  SeverityBadge,
} from '../components/ui/AdminState.jsx';

/**
 * Full cluster detail (F5): summary + chronological timeline of the same
 * reports payload (no extra fetch path beyond list clusters + cluster reports).
 */
const ClusterDetailPage = () => {
  const { clusterId } = useParams();
  const { data: clusters, isLoading, isError, error } = useClustersList();
  const reportsQuery = useClusterReports(clusterId, true);
  const verifyMutation = useVerifyCluster();
  const [actionError, setActionError] = useState(null);

  const cluster = (clusters || []).find(
    (c) => c.clusterId === clusterId || c.id === clusterId
  );

  const handleVerify = async () => {
    setActionError(null);
    try {
      await verifyMutation.mutateAsync(clusterId);
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Verify failed'
      );
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/clusters"
          className="text-sm text-admin-accent hover:underline"
        >
          ← Clusters
        </Link>
        <Link to="/map" className="text-sm text-admin-muted hover:text-admin-ink">
          Map
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Cluster detail</h2>
          <p className="admin-page-sub font-mono">{clusterId}</p>
        </div>
        {cluster?.status === 'unverified' ? (
          <button
            type="button"
            disabled={verifyMutation.isPending}
            onClick={handleVerify}
            className="admin-btn-primary"
          >
            {verifyMutation.isPending ? 'Verifying…' : 'Verify cluster'}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <p className="mt-3 text-sm text-admin-danger" role="alert">
          {actionError}
        </p>
      ) : null}

      {isLoading && !cluster ? (
        <LoadingNotice>Loading cluster…</LoadingNotice>
      ) : null}

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load cluster" />
      ) : null}

      {!isLoading && !cluster ? (
        <p className="mt-4 text-sm text-admin-muted">
          Cluster not found. It may have been merged or resolved.
        </p>
      ) : null}

      {cluster ? (
        <dl className="mt-5 grid max-w-lg grid-cols-[auto_1fr] gap-x-4 gap-y-2 border border-admin-line bg-admin-panel px-4 py-3 text-sm shadow-admin">
          <dt className="text-admin-muted">Severity</dt>
          <dd>
            <SeverityBadge severity={cluster.severity} />
          </dd>
          <dt className="text-admin-muted">Type</dt>
          <dd>{cluster.emergencyType}</dd>
          <dt className="text-admin-muted">Status</dt>
          <dd className="font-mono uppercase">{cluster.status}</dd>
          <dt className="text-admin-muted">Reports</dt>
          <dd className="font-mono">{cluster.reportCount}</dd>
          <dt className="text-admin-muted">Confidence</dt>
          <dd className="font-mono">
            {typeof cluster.confidenceScore === 'number'
              ? `${Math.round(cluster.confidenceScore * 100)}%`
              : '—'}
          </dd>
          <dt className="text-admin-muted">First report</dt>
          <dd className="font-mono text-xs">
            {cluster.firstReportAt
              ? new Date(cluster.firstReportAt).toLocaleString()
              : '—'}
          </dd>
          <dt className="text-admin-muted">Last report</dt>
          <dd className="font-mono text-xs">
            {cluster.lastReportAt
              ? new Date(cluster.lastReportAt).toLocaleString()
              : '—'}
          </dd>
        </dl>
      ) : null}

      {cluster ? (
        <>
          <h3 className="mt-8 text-sm font-semibold text-admin-ink">
            Timeline
          </h3>
          <p className="mt-1 text-xs text-admin-muted">
            Same cluster + reports data as the F5 list expansion — presented
            chronologically (first report → reports → escalations →
            verification).
          </p>
          <div className="mt-3 border border-admin-line bg-admin-panel px-4 py-4 shadow-admin">
            <ClusterTimeline
              cluster={cluster}
              reports={reportsQuery.data?.reports}
              isLoading={reportsQuery.isLoading}
              isError={reportsQuery.isError}
              error={reportsQuery.error}
            />
          </div>
        </>
      ) : null}
    </section>
  );
};

export default ClusterDetailPage;
