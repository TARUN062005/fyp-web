import { useMemo, useState } from 'react';
import { useReports } from '../hooks/useReports.js';
import { useDeleteReport, useDeleteReports } from '../hooks/useReportMutations.js';
import {
  buildReportParams,
  downloadBlob,
  exportReports,
} from '../services/reportService.js';
import { SEVERITY_LEVELS } from '../theme/severity.js';
import {
  AlertKindBadge,
  ErrorAlert,
  SeverityBadge,
} from '../components/ui/AdminState.jsx';
import ConfirmDeleteReportModal from '../components/reports/ConfirmDeleteReportModal.jsx';
import ConfirmDeleteSelectionModal from '../components/reports/ConfirmDeleteSelectionModal.jsx';
import ReportDetailPanel from '../components/reports/ReportDetailPanel.jsx';

const emptyFilters = {
  severity: '',
  from: '',
  to: '',
  minLng: '',
  minLat: '',
  maxLng: '',
  maxLat: '',
};

const toApiInstant = (localValue, endOfDay = false) => {
  if (!localValue) return undefined;
  // datetime-local → treat as local wall time
  if (localValue.includes('T')) {
    const d = new Date(localValue);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  // date-only
  const d = new Date(
    endOfDay ? `${localValue}T23:59:59.999` : `${localValue}T00:00:00.000`
  );
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

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
  return s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
};

const personLabel = (summary, fallbackId) => {
  if (summary?.displayName) {
    const id = summary.emergencyId ? ` · ${summary.emergencyId}` : '';
    return `${summary.displayName}${id}`;
  }
  return shortId(summary?.id || fallbackId);
};

const ReportsPage = () => {
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingBulk, setPendingBulk] = useState(false);

  const deleteMutation = useDeleteReport();
  const bulkDeleteMutation = useDeleteReports();

  const queryFilters = useMemo(
    () => ({
      page,
      limit: 20,
      severity: applied.severity || undefined,
      from: toApiInstant(applied.from, false),
      to: toApiInstant(applied.to, true),
      minLng: applied.minLng,
      minLat: applied.minLat,
      maxLng: applied.maxLng,
      maxLat: applied.maxLat,
    }),
    [applied, page]
  );

  const { data, isLoading, isError, error, isFetching } = useReports(queryFilters);

  const reports = data?.reports ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const selected = reports.find((r) => r.id === selectedId) || null;

  const setField = (key) => (e) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  const applyFilters = (e) => {
    e?.preventDefault?.();
    setApplied({ ...draft });
    setPage(1);
    setActionError(null);
    setActionMsg(null);
  };

  const clearFilters = () => {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
    setActionError(null);
    setActionMsg(null);
  };

  const handleExport = async (format) => {
    setExporting(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const exportFilters = {
        severity: applied.severity || undefined,
        from: toApiInstant(applied.from, false),
        to: toApiInstant(applied.to, true),
        minLng: applied.minLng,
        minLat: applied.minLat,
        maxLng: applied.maxLng,
        maxLat: applied.maxLat,
      };
      const result = await exportReports(exportFilters, format);
      downloadBlob(result.blob, result.filename);
      const filterSummary = buildReportParams(exportFilters);
      setActionMsg(
        `Exported ${result.filename} with current filters${
          Object.keys(filterSummary).length
            ? ` (${Object.keys(filterSummary)
                .filter((k) => k !== 'format')
                .join(', ')})`
            : ' (none — full accessible set up to export limit)'
        }`
      );
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Export failed'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (report) => {
    setActionError(null);
    setActionMsg(null);
    try {
      await deleteMutation.mutateAsync(report.id || report.messageId);
      setPendingDelete(null);
      if (selectedId === report.id) setSelectedId(null);
      setSelectedIds((ids) => ids.filter((id) => id !== report.id));
      setActionMsg(`Deleted ${report.messageId}`);
    } catch (err) {
      setActionError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Delete failed'
      );
    }
  };

  const handleBulkDelete = async () => {
    setActionError(null);
    setActionMsg(null);
    const ids = [...selectedIds];
    try {
      const result = await bulkDeleteMutation.mutateAsync(ids);
      setPendingBulk(false);
      setSelectedIds([]);
      setSelectedId(null);
      setActionMsg(`Deleted ${result?.deleted?.length || ids.length} reports`);
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
          <h2 className="admin-page-title">Reports</h2>
          <p className="admin-page-sub">
            SOS and broadcast alerts, with full sender/hop detail when you
            open a row. Filter, page, export, or delete a group.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('csv')}
            className="admin-btn-primary"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('json')}
            className="admin-btn"
          >
            Export JSON
          </button>
          <button
            type="button"
            className="admin-btn-danger"
            disabled={selectedIds.length === 0 || bulkDeleteMutation.isPending}
            onClick={() => setPendingBulk(true)}
          >
            Delete selected ({selectedIds.length})
          </button>
        </div>
      </div>

      <form
        onSubmit={applyFilters}
        className="mt-4 grid gap-3 border border-admin-line bg-admin-panel p-4 shadow-admin md:grid-cols-2 lg:grid-cols-4"
      >
        <label className="block text-xs font-medium text-admin-muted">
          Severity
          <select
            value={draft.severity}
            onChange={setField('severity')}
            className="admin-input mt-1"
          >
            <option value="">All</option>
            {SEVERITY_LEVELS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-admin-muted">
          From
          <input
            type="datetime-local"
            value={draft.from}
            onChange={setField('from')}
            className="admin-input mt-1 min-w-0"
          />
        </label>

        <label className="block text-xs font-medium text-admin-muted">
          To
          <input
            type="datetime-local"
            value={draft.to}
            onChange={setField('to')}
            className="admin-input mt-1 min-w-0"
          />
        </label>

        <div className="flex items-end gap-2">
          <button type="submit" className="admin-btn-primary">
            Apply filters
          </button>
          <button type="button" onClick={clearFilters} className="admin-btn">
            Clear
          </button>
        </div>

        <fieldset className="md:col-span-2 xl:col-span-4">
          <legend className="text-xs font-medium text-admin-muted">
            Location bounding box (all four required)
          </legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['minLng', 'Min lng'],
              ['minLat', 'Min lat'],
              ['maxLng', 'Max lng'],
              ['maxLat', 'Max lat'],
            ].map(([key, label]) => (
              <label
                key={key}
                className="block text-xs font-medium text-admin-muted"
              >
                {label}
                <input
                  type="number"
                  step="any"
                  value={draft[key]}
                  onChange={setField(key)}
                  placeholder={label}
                  className="admin-input mt-1 font-mono"
                />
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      {actionError ? (
        <p className="mt-3 text-sm text-admin-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionMsg ? (
        <p className="mt-3 text-sm text-admin-accent">{actionMsg}</p>
      ) : null}

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load reports" />
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-admin-muted">
        <p className="font-mono">
          {isLoading && !data
            ? 'loading…'
            : `${total} match${total === 1 ? '' : 'es'}`}
          {isFetching && data ? ' · updating' : ''}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
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
      </div>

      <div className="admin-table-wrap mt-2">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={
                    reports.length > 0 &&
                    reports.every((r) => selectedIds.includes(r.id))
                  }
                  onChange={() => {
                    const ids = reports.map((r) => r.id);
                    const allOn =
                      ids.length > 0 && ids.every((id) => selectedIds.includes(id));
                    setSelectedIds(allOn ? [] : ids);
                  }}
                  aria-label="Select all reports on this page"
                />
              </th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Uploads</th>
              <th className="px-3 py-2 font-medium">Hops</th>
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Sender</th>
              <th className="px-3 py-2 font-medium">Received via</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !reports.length ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-admin-muted">
                  Loading reports…
                </td>
              </tr>
            ) : null}

            {!isLoading && !reports.length ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-admin-muted">
                  No reports match the current filters.
                </td>
              </tr>
            ) : null}

            {reports.map((r) => (
              <tr
                key={r.id}
                className={[
                  'cursor-pointer border-b border-admin-line/80 hover:bg-admin-surface/60',
                  selectedId === r.id ? 'bg-admin-surface/80' : '',
                ].join(' ')}
                onClick={() =>
                  setSelectedId((id) => (id === r.id ? null : r.id))
                }
              >
                <td
                  className="px-3 py-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        prev.includes(r.id)
                          ? prev.filter((id) => id !== r.id)
                          : [...prev, r.id]
                      )
                    }
                    aria-label={`Select ${r.messageId}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <AlertKindBadge emergencyType={r.emergencyType} />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.messageId}</td>
                <td className="px-3 py-2 capitalize">{r.emergencyType}</td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={r.severity} />
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.verificationStatus || 'UNVERIFIED'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.uploadCount ?? 1}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.hopCount ?? 0}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {fmt(r.timestamp)}
                </td>
                <td
                  className="px-3 py-2 text-xs"
                  title={r.originalSenderId}
                >
                  {personLabel(r.originalSender, r.originalSenderId)}
                </td>
                <td
                  className="px-3 py-2 text-xs"
                  title={r.uploaderId}
                >
                  {personLabel(r.receivedBy, r.uploaderId)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="admin-btn-danger px-2 py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDelete(r);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="mt-4">
          <ReportDetailPanel
            report={selected}
            onClose={() => setSelectedId(null)}
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
        body="This removes the selected cloud copies from the reports list and their clusters. Phones that already received the mesh message keep their local copy."
        confirmLabel="Delete selected reports"
        busy={bulkDeleteMutation.isPending}
        onCancel={() => setPendingBulk(false)}
        onConfirm={handleBulkDelete}
      />
    </section>
  );
};

export default ReportsPage;

