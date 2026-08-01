import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { useAnalytics } from '../hooks/useAnalytics.js';
import { getSeverityColor, SEVERITY_LEVELS } from '../theme/severity.js';
import { getChartTokens } from '../theme/chartTokens.js';
import {
  ErrorAlert,
  LoadingNotice,
  EmptyNotice,
} from '../components/ui/AdminState.jsx';

const DAYS_OPTIONS = [7, 14, 30];

const ChartCard = ({ title, description, empty, children }) => (
  <section className="border border-admin-line bg-admin-panel p-4 shadow-admin">
    <h3 className="text-sm font-semibold text-admin-ink">{title}</h3>
    <p className="mt-0.5 text-xs text-admin-muted">{description}</p>
    <div className="mt-4 h-64 w-full">
      {empty ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-admin-muted">No data in this window.</p>
        </div>
      ) : (
        children
      )}
    </div>
  </section>
);

const AnalyticsPage = () => {
  const [days, setDays] = useState(14);
  const { data, isLoading, isError, error } = useAnalytics(days);
  const tokens = useMemo(() => getChartTokens(), [data?.generatedAt]);

  const tooltipStyle = {
    backgroundColor: tokens.panel,
    border: `1px solid ${tokens.line}`,
    borderRadius: 0,
    fontSize: 12,
    color: tokens.ink,
  };

  const severityData = useMemo(() => {
    const rows = data?.severityDistribution || [];
    return rows.map((row) => ({
      ...row,
      fill: SEVERITY_LEVELS.includes(row.severity)
        ? getSeverityColor(row.severity)
        : tokens.muted,
    }));
  }, [data, tokens.muted]);

  const volumeEmpty = !(data?.reportVolumeOverTime || []).some((d) => d.count > 0);
  const severityEmpty = !(data?.severityDistribution || []).some(
    (d) => d.count > 0
  );
  const growthEmpty = !(data?.clusterGrowthOverTime || []).some(
    (d) => d.created > 0 || d.cumulative > 0
  );

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Analytics</h2>
          <p className="admin-page-sub">
            Read-only trends from server aggregates — no mutating actions.
          </p>
        </div>
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label="Analytics window"
        >
          <span className="text-xs text-admin-muted">Window</span>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={days === d ? 'admin-chip-active' : 'admin-chip'}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 font-mono text-[11px] text-admin-muted">
        Source: GET /admin/analytics
        {data?.generatedAt
          ? ` · as of ${new Date(data.generatedAt).toLocaleString()}`
          : ''}
      </p>

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load analytics" />
      ) : null}

      {isLoading && !data ? (
        <LoadingNotice>Loading charts…</LoadingNotice>
      ) : null}

      {!isLoading && !isError && !data ? (
        <EmptyNotice>No analytics payload returned.</EmptyNotice>
      ) : null}

      {data ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Report volume over time"
            description="Daily EmergencyReport count in the selected window."
            empty={volumeEmpty}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.reportVolumeOverTime}>
                <CartesianGrid stroke={tokens.line} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Reports"
                  stroke={tokens.accent}
                  fill={tokens.accent}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Severity distribution"
            description="Report counts by severity (letter marks in legend)."
            empty={severityEmpty}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData}>
                <CartesianGrid stroke={tokens.line} strokeDasharray="3 3" />
                <XAxis
                  dataKey="severity"
                  tick={{ fontSize: 11, fill: tokens.muted }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Reports">
                  {severityData.map((entry) => (
                    <Cell key={entry.severity} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Cluster growth over time"
            description="New clusters per day (by first report) and cumulative total."
            empty={growthEmpty}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.clusterGrowthOverTime}>
                <CartesianGrid stroke={tokens.line} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: tokens.muted }}
                  width={36}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: tokens.ink }} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="New clusters"
                  stroke={tokens.high}
                  fill={tokens.high}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative"
                  stroke={tokens.ink}
                  fill={tokens.ink}
                  fillOpacity={0.06}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      ) : null}
    </section>
  );
};

export default AnalyticsPage;
