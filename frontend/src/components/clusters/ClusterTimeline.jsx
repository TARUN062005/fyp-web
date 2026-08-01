import { useMemo } from 'react';
import { getSeverityLabel } from '../../theme/severity.js';
import { SeverityBadge } from '../ui/AdminState.jsx';

const SEVERITY_RANK = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
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

/**
 * Vertical timeline built only from F5 cluster + reports payloads
 * (no extra API calls).
 */
export const buildClusterTimelineEvents = (cluster, reports = []) => {
  const sorted = [...reports].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  const events = [];
  let maxRank = 0;

  sorted.forEach((report, index) => {
    const severity = getSeverityLabel(report.severity);
    const rank = SEVERITY_RANK[severity] || 0;

    events.push({
      id: `report-${report.id}`,
      kind: index === 0 ? 'first_report' : 'report',
      at: report.timestamp,
      title: index === 0 ? 'First report' : 'Report received',
      severity,
      detail: report.messageId,
      meta: {
        sender: report.originalSenderId,
        uploader: report.uploaderId,
      },
    });

    if (rank > maxRank && index > 0) {
      events.push({
        id: `escalate-${report.id}`,
        kind: 'escalation',
        at: report.timestamp,
        title: 'Severity escalation',
        severity,
        detail: `Peak severity rose to ${severity}`,
        meta: null,
      });
    }
    maxRank = Math.max(maxRank, rank);
  });

  if (cluster?.status === 'verified') {
    events.push({
      id: 'verified',
      kind: 'verified',
      at: cluster.lastReportAt || null,
      title: 'Cluster verified',
      severity: getSeverityLabel(cluster.severity),
      detail: 'Marked verified by an admin',
      meta: null,
    });
  }

  return events;
};

const kindStyles = {
  first_report: 'border-admin-accent bg-admin-accent',
  report: 'border-admin-line bg-admin-muted',
  escalation: 'border-admin-severity-high bg-admin-severity-high',
  verified: 'border-admin-accent bg-admin-accent',
};

const kindLabel = {
  first_report: '1',
  report: '•',
  escalation: '↑',
  verified: '✓',
};

const ClusterTimeline = ({ cluster, reports, isLoading, isError, error }) => {
  const events = useMemo(
    () => buildClusterTimelineEvents(cluster, reports),
    [cluster, reports]
  );

  if (isLoading) {
    return <p className="text-sm text-admin-muted">Loading timeline…</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-admin-danger" role="alert">
        {error?.response?.data?.error?.message ||
          error?.message ||
          'Failed to load reports for timeline'}
      </p>
    );
  }

  if (!events.length) {
    return (
      <p className="text-sm text-admin-muted">
        No timeline events yet for this cluster.
      </p>
    );
  }

  return (
    <ol className="relative ms-2 border-l border-admin-line ps-6">
      {events.map((event) => (
        <li key={event.id} className="relative pb-6 last:pb-0">
          <span
            className={[
              'absolute -start-[1.55rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 font-mono text-[9px] font-semibold text-admin-surface',
              kindStyles[event.kind] || kindStyles.report,
            ].join(' ')}
            aria-hidden
          >
            {kindLabel[event.kind] || '•'}
          </span>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-admin-ink">{event.title}</p>
            <p className="font-mono text-[11px] text-admin-muted">
              {fmt(event.at)}
            </p>
          </div>
          <p className="mt-0.5 font-mono text-xs text-admin-muted">
            {event.detail}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            {event.severity ? (
              <SeverityBadge severity={event.severity} />
            ) : null}
            {event.meta ? (
              <span className="font-mono text-admin-muted">
                sender {shortId(event.meta.sender)} · uploader{' '}
                {shortId(event.meta.uploader)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default ClusterTimeline;
