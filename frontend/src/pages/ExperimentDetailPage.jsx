import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  downloadExperimentPdf,
  experimentDetailQueryKey,
  experimentTrialsQueryKey,
  fetchExperiment,
  fetchExperimentTrials,
} from '../services/experimentService.js';
import {
  EmptyNotice,
  ErrorAlert,
  LoadingNotice,
} from '../components/ui/AdminState.jsx';

const fmt = (value) => {
  if (value == null || value === '') return 'unavailable';
  return String(value);
};

const fmtMs = (value) =>
  value == null || !Number.isFinite(Number(value)) ? 'unavailable' : `${Math.round(value)} ms`;

const pct = (value) =>
  value == null || !Number.isFinite(Number(value)) ? 'unavailable' : `${value}%`;

const BarChart = ({ title, rows }) => {
  const usable = rows.filter((r) => r.value != null && Number.isFinite(r.value));
  const max = Math.max(...usable.map((r) => r.value), 1);
  return (
    <article className="border border-admin-line bg-admin-panel p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {!usable.length ? (
        <p className="mt-2 text-xs text-admin-muted">No measured values.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {usable.map((row) => (
            <li key={row.label}>
              <p className="text-[11px] text-admin-muted">{row.label}</p>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 bg-admin-accent"
                  style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                />
                <span className="font-mono text-xs">{row.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};

const ExperimentDetailPage = () => {
  const { experimentId } = useParams();
  const [scenario, setScenario] = useState('');
  const [delivered, setDelivered] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const detailQuery = useQuery({
    queryKey: experimentDetailQueryKey(experimentId),
    queryFn: () => fetchExperiment(experimentId),
    enabled: Boolean(experimentId),
  });

  const trialParams = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(scenario ? { scenario } : {}),
      ...(delivered ? { delivered } : {}),
    }),
    [scenario, delivered]
  );

  const trialsQuery = useQuery({
    queryKey: experimentTrialsQueryKey(experimentId, trialParams),
    queryFn: () => fetchExperimentTrials(experimentId, trialParams),
    enabled: Boolean(experimentId),
  });

  const bundle = detailQuery.data;
  const summary = bundle?.summary || {};
  const byScenario = bundle?.byScenario || {};
  const devices = bundle?.devices || [];
  const experiment = bundle?.experiment;
  const trials = trialsQuery.data?.items || [];

  const scenarioRows = Object.entries(byScenario).map(([label, s]) => ({
    label,
    ...s,
  }));

  const onDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadExperimentPdf(experimentId);
    } catch (err) {
      setDownloadError(err);
    } finally {
      setDownloading(false);
    }
  };

  if (detailQuery.isLoading) return <LoadingNotice>Loading experiment…</LoadingNotice>;
  if (detailQuery.isError) return <ErrorAlert error={detailQuery.error} />;
  if (!experiment) {
    return (
      <EmptyNotice>Experiment not found or no physical-device data uploaded.</EmptyNotice>
    );
  }

  return (
    <section>
      <p className="text-xs text-admin-muted">
        <Link to="/experiments" className="underline">
          Experiment Analytics
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{experiment.name}</h2>
          <p className="font-mono text-xs text-admin-muted">{experiment.experimentId}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-admin-muted">
            {experiment.measurementKind || 'PHYSICAL_ANDROID'} · not simulation
          </p>
        </div>
        <button
          type="button"
          className="border border-admin-line bg-admin-panel px-3 py-2 text-sm font-medium"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? 'Preparing PDF…' : 'Download PDF Report'}
        </button>
      </div>
      {downloadError ? <ErrorAlert error={downloadError} /> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="Delivery ratio" value={pct(summary.deliveryRatio)} />
        <Metric label="Average latency" value={fmtMs(summary.averageLatencyMs)} />
        <Metric label="Median latency" value={fmtMs(summary.medianLatencyMs)} />
        <Metric label="Average hops" value={fmt(summary.averageHopCount)} />
        <Metric label="Duplicate suppression" value={fmt(summary.duplicateSuppressionCount)} />
        <Metric label="Forwarding attempts" value={fmt(summary.forwardingAttempts)} />
        <Metric label="Routing overhead" value={fmt(summary.routingOverhead)} />
        <Metric label="Cloud relay success" value={pct(summary.cloudRelaySuccessRate)} />
        <Metric
          label="Trials"
          value={`${fmt(summary.successfulDeliveries)} ok / ${fmt(summary.failedTrialCount)} failed / ${fmt(summary.totalTrialCount)} total`}
        />
      </div>
      <p className="mt-3 text-xs text-admin-muted">
        Routing overhead = (MESSAGE_TRANSMISSION_ATTEMPTED + MESSAGE_FORWARDED) /
        unique successful destination deliveries. Latency uses clock-offset-adjusted
        timestamps; unreliable samples are unavailable, never zero.
      </p>

      <h3 className="mt-6 text-sm font-semibold">Participating devices</h3>
      {!devices.length ? (
        <EmptyNotice>No devices registered.</EmptyNotice>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {devices.map((d) => (
            <li key={`${d.experimentId}-${d.deviceId}`}>
              {d.role} · {d.model || 'unknown'} · Android {d.androidVersion || '?'} · app{' '}
              {d.appVersion || '?'} · {d.meshUserId}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold">Charts</h3>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <BarChart
          title="Delivery ratio by scenario"
          rows={scenarioRows.map((r) => ({ label: r.label, value: r.deliveryRatio }))}
        />
        <BarChart
          title="Average latency by scenario (ms)"
          rows={scenarioRows.map((r) => ({ label: r.label, value: r.averageLatencyMs }))}
        />
        <BarChart
          title="Average hop count by scenario"
          rows={scenarioRows.map((r) => ({ label: r.label, value: r.averageHopCount }))}
        />
        <BarChart
          title="Successful deliveries"
          rows={scenarioRows.map((r) => ({ label: r.label, value: r.successfulDeliveries }))}
        />
        <BarChart
          title="Failed deliveries"
          rows={scenarioRows.map((r) => ({ label: r.label, value: r.failedTrialCount }))}
        />
        <BarChart
          title="Duplicate suppression"
          rows={scenarioRows.map((r) => ({
            label: r.label,
            value: r.duplicateSuppressionCount,
          }))}
        />
        <BarChart
          title="Cloud relay success rate"
          rows={scenarioRows.map((r) => ({
            label: r.label,
            value: r.cloudRelaySuccessRate,
          }))}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <select
          className="border border-admin-line bg-admin-panel px-2 py-1 text-sm"
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          aria-label="Filter trials by scenario"
        >
          <option value="">All scenarios</option>
          {Object.keys(byScenario).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <select
          className="border border-admin-line bg-admin-panel px-2 py-1 text-sm"
          value={delivered}
          onChange={(e) => setDelivered(e.target.value)}
          aria-label="Filter trials by delivery"
        >
          <option value="">All delivery states</option>
          <option value="true">Delivered</option>
          <option value="false">Failed</option>
        </select>
      </div>

      <h3 className="mt-4 text-sm font-semibold">Trial records</h3>
      {trialsQuery.isLoading ? <LoadingNotice>Loading trials…</LoadingNotice> : null}
      {!trials.length ? (
        <EmptyNotice>No trials match the current filters.</EmptyNotice>
      ) : (
        <div className="mt-2 overflow-x-auto border border-admin-line bg-admin-panel">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-admin-canvas uppercase tracking-wide text-admin-muted">
              <tr>
                <th className="px-2 py-2">Trial</th>
                <th className="px-2 py-2">Scenario</th>
                <th className="px-2 py-2">Sender</th>
                <th className="px-2 py-2">Destination</th>
                <th className="px-2 py-2">Delivered</th>
                <th className="px-2 py-2">Latency</th>
                <th className="px-2 py-2">Hops</th>
                <th className="px-2 py-2">Dup</th>
                <th className="px-2 py-2">Forwards</th>
                <th className="px-2 py-2">Cloud</th>
                <th className="px-2 py-2">Failure</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.trialId} className="border-t border-admin-line">
                  <td className="px-2 py-2 font-mono">{t.trialId.slice(0, 8)}</td>
                  <td className="px-2 py-2">{t.scenario}</td>
                  <td className="px-2 py-2 font-mono">{t.senderDeviceId || '—'}</td>
                  <td className="px-2 py-2 font-mono">{t.destinationDeviceId || '—'}</td>
                  <td className="px-2 py-2">{t.delivered ? 'yes' : 'no'}</td>
                  <td className="px-2 py-2">
                    {t.latencyReliable ? fmtMs(t.latencyMs) : 'unavailable'}
                  </td>
                  <td className="px-2 py-2">{fmt(t.hopCount)}</td>
                  <td className="px-2 py-2">{fmt(t.duplicateCount)}</td>
                  <td className="px-2 py-2">{fmt(t.forwardingAttempts)}</td>
                  <td className="px-2 py-2">{t.cloudUploadStatus}</td>
                  <td className="px-2 py-2">{t.failureReason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const Metric = ({ label, value }) => (
  <article className="border border-admin-line bg-admin-panel px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-admin-muted">{label}</p>
    <p className="mt-1 font-mono text-sm">{value}</p>
  </article>
);

export default ExperimentDetailPage;
