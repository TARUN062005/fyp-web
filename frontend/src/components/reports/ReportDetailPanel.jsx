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

const coord = (location) => {
  const c = location?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return '—';
  return `${Number(c[1]).toFixed(5)}, ${Number(c[0]).toFixed(5)}`;
};

/**
 * Full audit card for one cloud SOS / broadcast report.
 */
const ReportDetailPanel = ({ report, onClose, onDelete }) => {
  if (!report) return null;
  const sos = String(report.emergencyType || '').toLowerCase() === 'sos';

  return (
    <div className="rounded border border-admin-line bg-admin-panel p-4 text-sm shadow-admin">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-admin-muted">
            {sos ? 'SOS detail' : 'Broadcast alert detail'}
          </p>
          <h2 className="mt-1 font-mono text-sm font-semibold break-all">
            {report.messageId}
          </h2>
          <p className="mt-1 text-xs text-admin-muted">
            {sos
              ? 'Personal SOS from a phone in danger.'
              : `Public broadcast alert (${report.emergencyType || 'other'}).`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onDelete ? (
            <button
              type="button"
              className="admin-btn-danger"
              onClick={() => onDelete(report)}
            >
              Delete
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="admin-btn" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-admin-muted">Kind</dt>
          <dd className="text-xs">{sos ? 'SOS' : 'Broadcast alert'}</dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Emergency type</dt>
          <dd className="text-xs capitalize">{report.emergencyType || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Severity</dt>
          <dd className="text-xs">{report.severity || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Who sent</dt>
          <dd className="text-xs">
            {personLabel(report.originalSender, report.originalSenderId)}
            {report.originalSender?.isVerified ? ' · verified account' : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Received to website by</dt>
          <dd className="text-xs">
            {personLabel(report.receivedBy, report.uploaderId)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">All uploaders</dt>
          <dd className="text-xs break-all">
            {(report.uploadersDetail || [])
              .map((u) => personLabel(u, u.id))
              .join(', ') ||
              (report.uploaders || []).join(', ') ||
              '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Counts</dt>
          <dd className="font-mono text-xs">
            uploads {report.uploadCount ?? 1} · relays {report.relayCount ?? 0} ·
            hops {report.hopCount ?? 0}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Verification</dt>
          <dd className="text-xs">
            {report.verificationStatus || 'UNVERIFIED'} · confidence{' '}
            {Math.round((report.confidenceScore || 0) * 100)}%
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Votes</dt>
          <dd className="text-xs">
            True {report.trueVotes ?? 0} ({report.truePercent ?? 0}%) · False{' '}
            {report.falseVotes ?? 0} ({report.falsePercent ?? 0}%) · Unknown{' '}
            {report.unknownVotes ?? 0} ({report.unknownPercent ?? 0}%)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">Sent at</dt>
          <dd className="font-mono text-xs">{fmt(report.timestamp)}</dd>
        </div>
        <div>
          <dt className="text-xs text-admin-muted">First / last upload</dt>
          <dd className="font-mono text-xs">
            {fmt(report.firstUploadedAt)} → {fmt(report.lastUploadedAt)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-admin-muted">Location (lat, lng)</dt>
          <dd className="font-mono text-xs">{coord(report.location)}</dd>
        </div>
      </dl>
    </div>
  );
};

export default ReportDetailPanel;
