import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClustersList } from '../hooks/useClusters.js';
import { useClusterReports } from '../hooks/useClusterReports.js';
import {
  useDeleteClusters,
  useMergeClusters,
  useVerifyCluster,
} from '../hooks/useClusterMutations.js';
import ClusterReportsTable from '../components/clusters/ClusterReportsTable.jsx';
import ConfirmDeleteReportModal from '../components/reports/ConfirmDeleteReportModal.jsx';
import ConfirmDeleteSelectionModal from '../components/reports/ConfirmDeleteSelectionModal.jsx';
import ReportDetailPanel from '../components/reports/ReportDetailPanel.jsx';
import {
  AlertKindBadge,
  ErrorAlert,
  SeverityBadge,
} from '../components/ui/AdminState.jsx';
import { useDeleteReport, useDeleteReports } from '../hooks/useReportMutations.js';
import { alertKind, isSosType } from '../utils/alertKind.js';

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'SOS', label: 'SOS' },
  { id: 'BROADCAST', label: 'Broadcast alerts' },
];

const ExpandedReports = ({ clusterId }) => {
  const { data, isLoading, isError, error } = useClusterReports(clusterId, true);
  const deleteMutation = useDeleteReport();
  const bulkDeleteMutation = useDeleteReports();
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingBulk, setPendingBulk] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [openId, setOpenId] = useState(null);

  const reports = data?.reports || [];
  const openReport = reports.find((r) => r.id === openId) || null;

  const handleDelete = async (report) => {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(report.id || report.messageId);
      setPendingDelete(null);
      setSelectedIds((ids) => ids.filter((id) => id !== report.id));
      if (openId === report.id) setOpenId(null);
    } catch (err) {
      setDeleteError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Delete failed'
      );
    }
  };

  const handleBulkDelete = async () => {
    setDeleteError(null);
    const ids = [...selectedIds];
    try {
      await bulkDeleteMutation.mutateAsync(ids);
      setPendingBulk(false);
      setSelectedIds([]);
      setOpenId(null);
    } catch (err) {
      setDeleteError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Delete failed'
      );
    }
  };

  return (
    <div className="px-3 py-3">
      {deleteError ? (
        <p className="mb-2 text-xs text-admin-danger" role="alert">
          {deleteError}
        </p>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-admin-muted">
          Click a row for sender, hops, votes, and location. SOS and broadcast
          alerts are labelled separately.
        </p>
        <button
          type="button"
          className="admin-btn-danger px-2 py-1"
          disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending}
          onClick={() => setPendingBulk(true)}
        >
          Delete selected ({selectedIds.length})
        </button>
      </div>
      <ClusterReportsTable
        reports={reports}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onDelete={setPendingDelete}
        deletingId={deleteMutation.isPending ? pendingDelete?.id : null}
        selectedIds={selectedIds}
        onToggleSelect={(id) =>
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
        onToggleAll={() => {
          const ids = reports.map((r) => r.id);
          const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
          setSelectedIds(allOn ? [] : ids);
        }}
        onOpen={(report) =>
          setOpenId((id) => (id === report.id ? null : report.id))
        }
        openId={openId}
      />
      {openReport ? (
        <div className="mt-3">
          <ReportDetailPanel
            report={openReport}
            onClose={() => setOpenId(null)}
            onDelete={setPendingDelete}
          />
        </div>
      ) : null}
      <ConfirmDeleteReportModal
        report={pendingDelete}
        busy={deleteMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
      <ConfirmDeleteSelectionModal
        open={pendingBulk}
        title={`Delete ${selectedIds.length} report${selectedIds.length === 1 ? '' : 's'}?`}
        body="This removes the selected cloud copies from this cluster. Phones that already received the mesh message keep their local copy."
        confirmLabel="Delete selected reports"
        busy={bulkDeleteMutation.isPending}
        onCancel={() => setPendingBulk(false)}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};

const ClustersPage = () => {
  const { data: clusters, isLoading, isError, error } = useClustersList();
  const verifyMutation = useVerifyCluster();
  const mergeMutation = useMergeClusters();
  const deleteMutation = useDeleteClusters();

  const [kindFilter, setKindFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const rows = useMemo(() => {
    const list = clusters || [];
    if (kindFilter === 'all') return list;
    return list.filter((c) => alertKind(c.emergencyType) === kindFilter);
  }, [clusters, kindFilter]);

  const sosCount = (clusters || []).filter((c) => isSosType(c.emergencyType)).length;
  const broadcastCount = (clusters || []).length - sosCount;

  const toggleSelect = (clusterId) => {
    setSelected((prev) =>
      prev.includes(clusterId)
        ? prev.filter((id) => id !== clusterId)
        : [...prev, clusterId]
    );
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
    if (selected.length < 2) {
      setActionError('Select at least two clusters to merge');
      return;
    }
    const ids = [...selected];
    const types = new Set(
      ids
        .map((id) => (clusters || []).find((c) => c.clusterId === id)?.emergencyType)
        .filter(Boolean)
    );
    if (types.size > 1) {
      setActionError(
        'Merge only clusters of the same kind (SOS with SOS, or the same broadcast type).'
      );
      return;
    }
    try {
      const result = await mergeMutation.mutateAsync({ clusterIds: ids });
      setSelected([]);
      setActionMsg(
        `Merged ${ids.length} clusters into ${result?.cluster?.clusterId}`
      );
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Merge failed'
      );
    }
  };

  const handleDeleteSelected = async () => {
    setActionError(null);
    setActionMsg(null);
    const ids = [...selected];
    try {
      const result = await deleteMutation.mutateAsync(ids);
      setPendingDelete(false);
      setSelected([]);
      if (ids.includes(expandedId)) setExpandedId(null);
      setActionMsg(
        `Deleted ${result?.deleted?.length || ids.length} cluster${
          ids.length === 1 ? '' : 's'
        }`
      );
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Delete failed'
      );
    }
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Clusters</h2>
          <p className="admin-page-sub">
            SOS and broadcast alerts are grouped separately. Merge two or more
            of the same kind, or delete a group.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-[11px] text-admin-muted">
            {selected.length} selected
          </p>
          <button
            type="button"
            disabled={selected.length < 2 || mergeMutation.isPending}
            onClick={handleMerge}
            className="admin-btn"
          >
            {mergeMutation.isPending ? 'Merging…' : 'Merge selected'}
          </button>
          <button
            type="button"
            disabled={selected.length === 0 || deleteMutation.isPending}
            onClick={() => setPendingDelete(true)}
            className="admin-btn-danger"
          >
            Delete selected
          </button>
        </div>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Cluster kind filter"
      >
        {KIND_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setKindFilter(filter.id)}
            className={[
              'rounded px-2 py-1 text-xs',
              kindFilter === filter.id
                ? 'bg-admin-accent-soft text-admin-ink'
                : 'border border-admin-line bg-white text-admin-muted',
            ].join(' ')}
          >
            {filter.label}
            {filter.id === 'SOS' ? ` (${sosCount})` : ''}
            {filter.id === 'BROADCAST' ? ` (${broadcastCount})` : ''}
          </button>
        ))}
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
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">Select</th>
              <th className="px-3 py-2 font-medium">Kind</th>
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
                <td colSpan={9} className="px-3 py-6 text-admin-muted">
                  Loading clusters…
                </td>
              </tr>
            ) : null}

            {!isLoading && !rows.length ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-admin-muted">
                  No clusters in this filter.
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

      <ConfirmDeleteSelectionModal
        open={pendingDelete}
        title={`Delete ${selected.length} cluster${selected.length === 1 ? '' : 's'}?`}
        body="This removes the selected clusters and every cloud SOS/broadcast inside them. Mesh copies on phones are not retracted."
        confirmLabel="Delete clusters"
        busy={deleteMutation.isPending}
        onCancel={() => setPendingDelete(false)}
        onConfirm={handleDeleteSelected}
      />
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
          aria-label={`Select ${cluster.clusterId}`}
        />
      </td>
      <td className="px-3 py-2">
        <AlertKindBadge emergencyType={cluster.emergencyType} />
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
        <p className="mt-0.5 text-xs capitalize text-admin-muted">
          {isSosType(cluster.emergencyType)
            ? 'Personal SOS'
            : `${cluster.emergencyType} broadcast`}
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
        <td colSpan={9} className="px-0 py-0">
          <ExpandedReports clusterId={cluster.clusterId} />
        </td>
      </tr>
    ) : null}
  </>
);

export default ClustersPage;
