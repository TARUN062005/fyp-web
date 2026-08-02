import { useMemo, useState } from 'react';
import { useReports } from '../hooks/useReports.js';
import {
  buildReportParams,
  downloadBlob,
  exportReports,
} from '../services/reportService.js';
import { SEVERITY_LEVELS } from '../theme/severity.js';
import {
  ErrorAlert,
  SeverityBadge,
} from '../components/ui/AdminState.jsx';

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

const ReportsPage = () => {
  const [draft, setDraft] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Reports</h2>
          <p className="admin-page-sub">
            Raw relay uploads — filter, page, and export the same result set.
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
              <th className="px-3 py-2 font-medium">Message</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Uploads</th>
              <th className="px-3 py-2 font-medium">Hops</th>
              <th className="px-3 py-2 font-medium">Timestamp</th>
              <th className="px-3 py-2 font-medium">Sender</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !reports.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-admin-muted">
                  Loading reports…
                </td>
              </tr>
            ) : null}

            {!isLoading && !reports.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-admin-muted">
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
                <td className="px-3 py-2 font-mono text-xs">{r.messageId}</td>
                <td className="px-3 py-2">{r.emergencyType}</td>
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
                  className="px-3 py-2 font-mono text-xs"
                  title={r.originalSenderId}
                >
                  {shortId(r.originalSenderId)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="mt-4 rounded border border-admin-line bg-admin-panel p-4 text-sm shadow-admin">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-admin-muted">
                Report audit
              </p>
              <h2 className="mt-1 font-mono text-sm font-semibold">
                {selected.messageId}
              </h2>
            </div>
            <button
              type="button"
              className="admin-btn"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-admin-muted">Original sender</dt>
              <dd className="font-mono text-xs">{selected.originalSenderId}</dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">First uploader</dt>
              <dd className="font-mono text-xs">{selected.uploaderId}</dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">Uploaders</dt>
              <dd className="font-mono text-xs break-all">
                {(selected.uploaders || []).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">Counts</dt>
              <dd className="font-mono text-xs">
                uploads {selected.uploadCount ?? 1} · relays{' '}
                {selected.relayCount ?? 0} · hops {selected.hopCount ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">Verification</dt>
              <dd className="text-xs">
                {selected.verificationStatus || 'UNVERIFIED'} · confidence{' '}
                {Math.round((selected.confidenceScore || 0) * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">Votes</dt>
              <dd className="text-xs">
                True {selected.trueVotes ?? 0} ({selected.truePercent ?? 0}%) ·
                False {selected.falseVotes ?? 0} ({selected.falsePercent ?? 0}%) ·
                Unknown {selected.unknownVotes ?? 0} (
                {selected.unknownPercent ?? 0}%)
              </dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">First / last upload</dt>
              <dd className="font-mono text-xs">
                {fmt(selected.firstUploadedAt)} → {fmt(selected.lastUploadedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-admin-muted">Location</dt>
              <dd className="font-mono text-xs">
                {(selected.location?.coordinates || []).join(', ') || '—'}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
};

export default ReportsPage;
