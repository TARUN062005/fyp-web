import { useDashboardSummary } from '../hooks/useDashboardSummary.js';
import { ErrorAlert, LoadingNotice } from '../components/ui/AdminState.jsx';

const cards = [
  {
    key: 'activeEmergencies',
    label: 'Active emergencies',
    hint: 'Open clusters (unverified + verified)',
  },
  {
    key: 'clustersToday',
    label: 'Clusters today',
    hint: 'Clusters with activity since midnight',
  },
  {
    key: 'verifiedUsers',
    label: 'Verified users',
    hint: 'Identities that completed verification',
  },
  {
    key: 'blockedUsers',
    label: 'Blocked users',
    hint: 'Currently blocked mobile accounts',
  },
  {
    key: 'devicesOnline',
    label: 'Devices online',
    hint: 'Active installs seen recently',
  },
];

const SummaryCard = ({ label, value, hint, live, loading }) => (
  <article
    className="border border-admin-line bg-admin-panel px-4 py-3 shadow-admin"
    aria-busy={loading || undefined}
  >
    <div className="flex items-start justify-between gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-admin-muted">
        {label}
      </p>
      {live ? (
        <span className="font-mono text-[10px] uppercase tracking-wider text-admin-accent">
          live
        </span>
      ) : null}
    </div>
    <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-admin-ink">
      {value}
    </p>
    <p className="mt-1 text-xs text-admin-muted">{hint}</p>
  </article>
);

const DashboardPage = () => {
  const { data, isLoading, isError, error, dataUpdatedAt, isFetching } =
    useDashboardSummary();

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Dashboard</h2>
          <p className="admin-page-sub">
            Ops overview — counters update live from the admin socket.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          {data?.generatedAt
            ? `as of ${new Date(data.generatedAt).toLocaleTimeString()}`
            : isLoading
              ? 'loading…'
              : '—'}
          {dataUpdatedAt
            ? ` · cache ${new Date(dataUpdatedAt).toLocaleTimeString()}`
            : ''}
          {isFetching && data ? ' · updating' : ''}
        </p>
      </div>

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load dashboard summary" />
      ) : null}

      {isLoading && !data ? (
        <LoadingNotice>Loading dashboard summary…</LoadingNotice>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard
            key={card.key}
            label={card.label}
            hint={card.hint}
            live={Boolean(data)}
            loading={isLoading && !data}
            value={
              isLoading && !data
                ? '—'
                : Number(data?.[card.key] ?? 0).toLocaleString()
            }
          />
        ))}
      </div>
    </section>
  );
};

export default DashboardPage;
