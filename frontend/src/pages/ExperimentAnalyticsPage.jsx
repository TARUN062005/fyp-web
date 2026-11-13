import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  experimentsQueryKey,
  fetchExperiments,
} from '../services/experimentService.js';
import {
  EmptyNotice,
  ErrorAlert,
  LoadingNotice,
} from '../components/ui/AdminState.jsx';

const fmt = (value) => {
  if (value == null || value === '') return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const pct = (value) => (value == null ? 'unavailable' : `${value}%`);

const ExperimentAnalyticsPage = () => {
  const [status, setStatus] = useState('');
  const [scenario, setScenario] = useState('');
  const params = useMemo(
    () => ({
      page: 1,
      limit: 50,
      ...(status ? { status } : {}),
      ...(scenario ? { scenario } : {}),
    }),
    [status, scenario]
  );
  const query = useQuery({
    queryKey: experimentsQueryKey(params),
    queryFn: () => fetchExperiments(params),
    staleTime: 15_000,
  });

  const items = query.data?.items || [];

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-admin-ink">
            Experiment Analytics
          </h2>
          <p className="mt-1 text-sm text-admin-muted">
            Physical Android device measurements only. Simulator results are not
            mixed into this view.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          className="border border-admin-line bg-admin-panel px-2 py-1 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="PAUSED">PAUSED</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
        <select
          className="border border-admin-line bg-admin-panel px-2 py-1 text-sm"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          aria-label="Filter by scenario"
        >
          <option value="">All scenarios</option>
          <option value="DIRECT_BROADCAST">Direct Broadcast</option>
          <option value="PRIVATE_CHAT">Private Chat</option>
          <option value="THREE_PHONE_LINE">Three-Phone Line</option>
          <option value="FOUR_PHONE_LINE">Four-Phone Line</option>
          <option value="DUPLICATE_SUPPRESSION">Duplicate Suppression</option>
          <option value="OFFLINE_SENDER_TO_INTERNET_RELAY">
            Offline Sender to Internet Relay
          </option>
          <option value="HOP_LIMIT">Hop Limit</option>
        </select>
      </div>

      {query.isLoading ? <LoadingNotice>Loading experiments…</LoadingNotice> : null}
      {query.isError ? <ErrorAlert error={query.error} /> : null}
      {!query.isLoading && !items.length ? (
        <EmptyNotice>
          No physical-device experiments uploaded yet. Create an experiment in the
          Android app, run trials on 2–4 phones, then upload results.
        </EmptyNotice>
      ) : null}

      {items.length ? (
        <div className="mt-4 overflow-x-auto border border-admin-line bg-admin-panel">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-admin-canvas text-xs uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="px-3 py-2">Experiment</th>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Devices</th>
                <th className="px-3 py-2">Trials</th>
                <th className="px-3 py-2">Success</th>
                <th className="px-3 py-2">Failed</th>
                <th className="px-3 py-2">Delivery</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.experimentId} className="border-t border-admin-line">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-admin-accent underline"
                      to={`/experiments/${encodeURIComponent(item.experimentId)}`}
                    >
                      {item.name}
                    </Link>
                    <p className="font-mono text-[11px] text-admin-muted">
                      {item.experimentId}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-admin-muted">
                      {item.measurementKind || 'PHYSICAL_ANDROID'}
                    </p>
                  </td>
                  <td className="px-3 py-2">{item.scenario}</td>
                  <td className="px-3 py-2">{item.participatingDevices ?? '—'}</td>
                  <td className="px-3 py-2">{item.trialCount ?? '—'}</td>
                  <td className="px-3 py-2">{item.successfulDeliveries ?? '—'}</td>
                  <td className="px-3 py-2">{item.failedDeliveries ?? '—'}</td>
                  <td className="px-3 py-2">{pct(item.deliveryRatio)}</td>
                  <td className="px-3 py-2">{fmt(item.startedAt || item.createdAt)}</td>
                  <td className="px-3 py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};

export default ExperimentAnalyticsPage;
