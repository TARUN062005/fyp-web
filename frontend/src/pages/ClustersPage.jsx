import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClustersList } from '../hooks/useClusters.js';
import { useClusterReports } from '../hooks/useClusterReports.js';
import {
  useMergeClusters,
  useVerifyCluster,
} from '../hooks/useClusterMutations.js';
import ClusterReportsTable from '../components/clusters/ClusterReportsTable.jsx';
import { ErrorAlert, SeverityBadge } from '../components/ui/AdminState.jsx';

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const ExpandedReports = ({ clusterId }) => {
  const { data, isLoading, isError, error } = useClusterReports(clusterId, true);
  return (
    <ClusterReportsTable
      reports={data?.reports}
      isLoading={isLoading}
      isError={isError}
      error={error}
    />
  );
};

const ClustersPage = () => {
  const { data: clusters, isLoading, isError, error } = useClustersList();
  const verifyMutation = useVerifyCluster();
  const mergeMutation = useMergeClusters();

  const [expandedId, setExpandedId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [actionError, setActionError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const rows = useMemo(() => clusters || [], [clusters]);

  const toggleSelect = (clusterId) => {
    setSelected((prev) => {
      if (prev.includes(clusterId)) {
        return prev.filter((id) => id !== clusterId);
      }
      if (prev.length >= 2) {
        return [prev[1], clusterId];
      }
      return [...prev, clusterId];
    });
  };

  const handleVerify = async (clusterId) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await verifyMutation.mutateAsync(clusterId);
      setActionMsg(`Verified ${clusterId}`);
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Verify failed'
      );
    }
  };

  const handleMerge = async () => {
    setActionError(null);
    setActionMsg(null);
    if (selected.length !== 2) {
      setActionError('Select exactly two clusters to merge');
      return;
    }
    const [sourceClusterId, targetClusterId] = selected;
    try {
      const result = await mergeMutation.mutateAsync({
        sourceClusterId,
        targetClusterId,
      });
      setSelected([]);
      setActionMsg(
        `Merged ${sourceClusterId} into ${result?.cluster?.clusterId || targetClusterId}`
      );
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Merge failed'
      );
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Clusters</h2>
          <p className="admin-page-sub">
            Review, verify, and merge emergency clusters.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] text-admin-muted">
            {selected.length}/2 selected for merge
          </p>
          <button
            type="button"
            disabled={selected.length !== 2 || mergeMutation.isPending}
            onClick={handleMerge}
            className="admin-btn"
          >
            {mergeMutation.isPending ? 'Merging…' : 'Merge clusters'}
          </button>
        </div>
      </div>

      {actionError ? (
        <p className="mt-3 text-sm text-admin-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionMsg ? (
        <p className="mt-3 text-sm text-admin-accent" role="status">
          {actionMsg}
        </p>
      ) : null}

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load clusters" />
      ) : null}

      <div className="admin-table-wrap mt-4">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">Merge</th>
              <th className="px-3 py-2 font-medium">Cluster</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Reports</th>
              <th className="px-3 py-2 font-medium">First report</th>
              <th className="px-3 py-2 font-medium">Last report</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !rows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-admin-muted">
                  Loading clusters…
                </td>
              </tr>
            ) : null}

            {!isLoading && !rows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-admin-muted">
                  No clusters yet.
                </td>
              </tr>
            ) : null}

            {rows.map((cluster) => {
              const open = expandedId === cluster.clusterId;
              const checked = selected.includes(cluster.clusterId);
              const canVerify = cluster.status === 'unverified';

              return (
                <FragmentRow
                  key={cluster.id || cluster.clusterId}
                  cluster={cluster}
                  open={open}
                  checked={checked}
                  canVerify={canVerify}
                  verifying={
                    verifyMutation.isPending &&
                    verifyMutation.variables === cluster.clusterId
                  }
                  onToggleExpand={() =>
                    setExpandedId((id) =>
                      id === cluster.clusterId ? null : cluster.clusterId
                    )
                  }
                  onToggleSelect={() => toggleSelect(cluster.clusterId)}
                  onVerify={() => handleVerify(cluster.clusterId)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const FragmentRow = ({
  cluster,
  open,
  checked,
  canVerify,
  verifying,
  onToggleExpand,
  onToggleSelect,
  onVerify,
}) => (
  <>
    <tr className="border-b border-admin-line/80 hover:bg-admin-surface/60">
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          aria-label={`Select ${cluster.clusterId} for merge`}
        />
      </td>
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={open}
          className="text-left font-mono text-xs text-admin-accent hover:underline"
        >
          {open ? '▾' : '▸'} {cluster.clusterId}
        </button>
        <p className="mt-0.5 text-xs text-admin-muted">
          {cluster.emergencyType}
        </p>
      </td>
      <td className="px-3 py-2">
        <SeverityBadge severity={cluster.severity} />
      </td>
      <td className="px-3 py-2 font-mono">{cluster.reportCount ?? 0}</td>
      <td className="px-3 py-2 font-mono text-xs">
        {fmt(cluster.firstReportAt)}
      </td>
      <td className="px-3 py-2 font-mono text-xs">
        {fmt(cluster.lastReportAt)}
      </td>
      <td className="px-3 py-2">
        <span className="font-mono text-xs uppercase tracking-wide">
          {cluster.status}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canVerify || verifying}
            onClick={onVerify}
            className="admin-btn px-2 py-1"
          >
            {verifying ? 'Verifying…' : 'Verify cluster'}
          </button>
          <Link
            to={`/clusters/${encodeURIComponent(cluster.clusterId)}`}
            className="admin-btn px-2 py-1"
          >
            Detail
          </Link>
        </div>
      </td>
    </tr>
    {open ? (
      <tr className="border-b border-admin-line bg-admin-surface/40">
        <td colSpan={8} className="px-0 py-0">
          <ExpandedReports clusterId={cluster.clusterId} />
        </td>
      </tr>
    ) : null}
  </>
);

export default ClustersPage;
