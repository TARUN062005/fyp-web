import { useState } from 'react';
import { useDevices } from '../hooks/useDevices.js';
import { ErrorAlert } from '../components/ui/AdminState.jsx';

const PRESENCE_FILTERS = [
  { id: '', label: 'All presence' },
  { id: 'online', label: 'Online' },
  { id: 'offline', label: 'Offline' },
];

const STATUS_FILTERS = [
  { id: '', label: 'All status' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'revoked', label: 'Revoked' },
];

const SORT_OPTIONS = [
  { id: '-lastSeenAt', label: 'Last seen ↓' },
  { id: 'lastSeenAt', label: 'Last seen ↑' },
  { id: '-appVersion', label: 'App version ↓' },
  { id: 'appVersion', label: 'App version ↑' },
];

const fmt = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};

const DevicesPage = () => {
  const [presence, setPresence] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('-lastSeenAt');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useDevices({
    page,
    limit: 50,
    online: presence,
    status,
    sort,
  });

  const devices = data?.devices ?? [];
  const totalPages = data?.totalPages ?? 1;
  const windowMinutes = data?.onlineWindowMinutes;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Devices</h2>
          <p className="admin-page-sub">
            Install inventory and online/offline presence.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          {isLoading && !data
            ? 'loading…'
            : `${data?.total ?? 0} device${data?.total === 1 ? '' : 's'}`}
          {isFetching && data ? ' · updating' : ''}
        </p>
      </div>

      <p className="mt-3 text-xs text-admin-muted">
        Online = lifecycle <span className="font-mono">active</span> and{' '}
        <span className="font-mono">lastSeenAt</span> within the last{' '}
        <span className="font-mono">
          {windowMinutes != null ? windowMinutes : '…'}
        </span>{' '}
        minutes
        {windowMinutes != null ? (
          <span className="font-mono">
            {' '}
            (DEVICE_ONLINE_WINDOW_MS={data.onlineWindowMs})
          </span>
        ) : null}
        .
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3 border-b border-admin-line pb-3">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Presence filter"
        >
          {PRESENCE_FILTERS.map((tab) => (
            <button
              key={tab.id || 'all-presence'}
              type="button"
              aria-pressed={presence === tab.id}
              onClick={() => {
                setPresence(tab.id);
                setPage(1);
              }}
              className={
                presence === tab.id ? 'admin-chip-active' : 'admin-chip'
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="text-xs font-medium text-admin-muted">
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="admin-input ml-1 inline-block w-auto px-2 py-1 text-xs"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.id || 'all-status'} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-admin-muted">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="admin-input ml-1 inline-block w-auto px-2 py-1 text-xs"
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isError ? (
        <ErrorAlert error={error} fallback="Failed to load devices" />
      ) : null}

      <div className="admin-table-wrap mt-4">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead>
            <tr className="border-b border-admin-line text-xs uppercase tracking-wide text-admin-muted">
              <th className="px-3 py-2 font-medium">Device ID</th>
              <th className="px-3 py-2 font-medium">App version</th>
              <th className="px-3 py-2 font-medium">Last seen</th>
              <th className="px-3 py-2 font-medium">Presence</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && !devices.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-admin-muted">
                  Loading devices…
                </td>
              </tr>
            ) : null}

            {!isLoading && !devices.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-admin-muted">
                  No devices match this filter.
                </td>
              </tr>
            ) : null}

            {devices.map((device) => (
              <tr
                key={device.id}
                className="border-b border-admin-line/80 hover:bg-admin-surface/60"
              >
                <td className="px-3 py-2 font-mono text-xs">{device.deviceId}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {device.appVersion || '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {fmt(device.lastSeenAt)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide',
                      device.online ? 'text-admin-accent' : 'text-admin-muted',
                    ].join(' ')}
                  >
                    <span aria-hidden>{device.online ? '●' : '○'}</span>
                    {device.online ? 'online' : 'offline'}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{device.status}</td>
                <td
                  className="px-3 py-2 font-mono text-xs"
                  title={device.userId}
                >
                  {String(device.userId).length > 12
                    ? `${String(device.userId).slice(0, 6)}…${String(device.userId).slice(-4)}`
                    : device.userId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-admin-muted">
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
    </section>
  );
};

export default DevicesPage;
