import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorAlert, LoadingNotice } from '../components/ui/AdminState.jsx';
import GatewayRadarCanvas from '../components/radar/GatewayRadarCanvas.jsx';
import { useAdminSocketApi } from '../hooks/useAdminSocket.js';
import {
  formatAge,
  gatewayStatusFromAge,
  mergeGatewayList,
  RadarSocketEvents,
  shouldApplyRadarUpdate,
} from '../radar/radarModel.js';
import {
  fetchRadarGateway,
  fetchRadarGateways,
  radarGatewayQueryKey,
  radarGatewaysQueryKey,
} from '../services/radarService.js';

const statusClass = (status) => {
  if (status === 'LIVE') return 'text-admin-accent';
  if (status === 'STALE') return 'text-amber-700';
  return 'text-admin-danger';
};

const LiveRadarPage = () => {
  const queryClient = useQueryClient();
  const { connected, connectionKey, subscribeRadar, unsubscribeRadar, getSocket } =
    useAdminSocketApi();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const gatewaysQuery = useQuery({
    queryKey: radarGatewaysQueryKey,
    queryFn: fetchRadarGateways,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      unsubscribeRadar();
    };
  }, [unsubscribeRadar]);

  useEffect(() => {
    if (!selectedId) return undefined;
    subscribeRadar(selectedId);
    let cancelled = false;
    fetchRadarGateway(selectedId)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, subscribeRadar, connectionKey]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const onUpdated = (payload) => {
      if (!shouldApplyRadarUpdate(selectedId, payload)) return;
      setSnapshot(payload);
      queryClient.setQueryData(radarGatewayQueryKey(selectedId), payload);
    };
    const onStatus = (payload) => {
      queryClient.setQueryData(radarGatewaysQueryKey, (prev) => ({
        gateways: mergeGatewayList(prev?.gateways || [], payload),
      }));
      if (shouldApplyRadarUpdate(selectedId, payload)) {
        setSnapshot((s) => (s ? { ...s, status: payload.status } : s));
      }
    };

    socket.on(RadarSocketEvents.GATEWAY_UPDATED, onUpdated);
    socket.on(RadarSocketEvents.GATEWAY_STATUS, onStatus);
    return () => {
      socket.off(RadarSocketEvents.GATEWAY_UPDATED, onUpdated);
      socket.off(RadarSocketEvents.GATEWAY_STATUS, onStatus);
    };
  }, [getSocket, connectionKey, selectedId, queryClient]);

  const gateways = gatewaysQuery.data?.gateways ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return gateways;
    return gateways.filter((g) =>
      [g.displayName, g.emergencyId, g.gatewayUserId]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [gateways, query]);

  const selectedGateway =
    gateways.find((g) => g.gatewayUserId === selectedId) || null;
  const lastUpdatedAt = snapshot?.lastUpdatedAt || selectedGateway?.lastUpdatedAt;
  const liveStatus =
    snapshot?.status ||
    selectedGateway?.status ||
    gatewayStatusFromAge(lastUpdatedAt, now);
  const peers = snapshot?.peers || [];
  const selectedPeer = peers.find((p) => p.peerId === selectedPeerId) || null;
  const stale = liveStatus !== 'LIVE';

  const selectGateway = (id) => {
    if (selectedId && selectedId !== id) {
      unsubscribeRadar(selectedId);
    }
    setSelectedPeerId(null);
    setSnapshot(null);
    setSelectedId(id);
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="admin-page-title">Live Radar</h2>
          <p className="admin-page-sub">
            Gateway perspective from the selected Internet-connected Android
            node. Distances are RSSI estimates; direction is a visual sector,
            not a compass bearing.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          socket {connected ? 'connected' : 'disconnected'}
        </p>
      </div>

      {gatewaysQuery.isError ? (
        <ErrorAlert error={gatewaysQuery.error} fallback="Could not load gateways" />
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="border border-admin-line bg-admin-panel p-3 shadow-admin">
          <label className="block text-xs font-medium text-admin-muted">
            Search users
            <input
              className="admin-input mt-1 rounded px-2 py-1.5"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or Emergency ID"
            />
          </label>
          {gatewaysQuery.isLoading ? (
            <LoadingNotice>Loading gateways…</LoadingNotice>
          ) : filtered.length === 0 ? (
            <p className="mt-3 text-sm text-admin-muted">
              No eligible gateways. An Android phone must be online and
              publishing radar.
            </p>
          ) : (
            <ul className="mt-3 space-y-1">
              {filtered.map((g) => {
                const status = gatewayStatusFromAge(g.lastUpdatedAt, now) === 'LIVE'
                  ? g.status || 'LIVE'
                  : gatewayStatusFromAge(g.lastUpdatedAt, now);
                return (
                  <li key={g.gatewayUserId}>
                    <button
                      type="button"
                      onClick={() => selectGateway(g.gatewayUserId)}
                      className={[
                        'w-full rounded px-2 py-2 text-left text-sm',
                        selectedId === g.gatewayUserId
                          ? 'bg-admin-accent-soft text-admin-ink'
                          : 'hover:bg-admin-surface',
                      ].join(' ')}
                    >
                      <span className="block font-medium">{g.displayName}</span>
                      <span className="font-mono text-[10px] text-admin-muted">
                        {g.emergencyId || g.gatewayUserId.slice(-6)}
                      </span>
                      <span
                        className={`ml-2 font-mono text-[10px] uppercase ${statusClass(status)}`}
                      >
                        {status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="border border-admin-line bg-admin-panel p-3 shadow-admin">
          {!selectedId ? (
            <p className="text-sm text-admin-muted">
              Select an Internet-connected gateway to view its radar.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-admin-muted">
                    Selected gateway
                  </p>
                  <h3 className="text-lg font-semibold">
                    {selectedGateway?.displayName ||
                      snapshot?.displayName ||
                      'Gateway'}
                  </h3>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-xs font-semibold uppercase ${statusClass(liveStatus)}`}
                  >
                    {liveStatus}
                  </p>
                  <p className="font-mono text-[11px] text-admin-muted">
                    Last update: {formatAge(lastUpdatedAt, now)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex justify-center bg-[#0f1720]">
                <GatewayRadarCanvas
                  peers={peers}
                  radarRangeMeters={snapshot?.radarRangeMeters || 20}
                  selectedPeerId={selectedPeerId}
                  onSelectPeer={(peer) => setSelectedPeerId(peer.peerId)}
                  stale={stale}
                />
              </div>

              {selectedPeer ? (
                <div className="mt-3 border border-admin-line bg-admin-surface p-3 text-sm">
                  <div className="flex justify-between">
                    <p className="font-medium">Selected node</p>
                    <button
                      type="button"
                      className="admin-btn"
                      onClick={() => setSelectedPeerId(null)}
                    >
                      Clear
                    </button>
                  </div>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-admin-muted">Name</dt>
                      <dd>{selectedPeer.displayName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-admin-muted">Distance</dt>
                      <dd className="font-mono">
                        {selectedPeer.beyondRadarRange
                          ? `>${snapshot?.radarRangeMeters || 20} m (est.)`
                          : `${Number(selectedPeer.distanceMeters).toFixed(1)} m (est.)`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-admin-muted">
                        Direction (visual sector)
                      </dt>
                      <dd className="font-mono">
                        {Number(selectedPeer.angleDegrees).toFixed(0)}°
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-admin-muted">Status</dt>
                      <dd>{selectedPeer.connectionState}</dd>
                    </div>
                    {selectedPeer.emergencyId ? (
                      <div>
                        <dt className="text-xs text-admin-muted">Emergency ID</dt>
                        <dd className="font-mono">{selectedPeer.emergencyId}</dd>
                      </div>
                    ) : null}
                    {selectedPeer.lastSeen ? (
                      <div>
                        <dt className="text-xs text-admin-muted">Last seen</dt>
                        <dd>{formatAge(selectedPeer.lastSeen, now)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : (
                <p className="mt-3 text-xs text-admin-muted">
                  {peers.length} nearby node{peers.length === 1 ? '' : 's'}. Click a
                  node for details.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default LiveRadarPage;
