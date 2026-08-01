import { useState } from 'react';
import { useClusters } from '../hooks/useClusters.js';
import ClusterMap from '../components/map/ClusterMap.jsx';
import ClusterDetailDrawer from '../components/map/ClusterDetailDrawer.jsx';
import SeverityLegend from '../components/map/SeverityLegend.jsx';
import { ErrorAlert, LoadingNotice } from '../components/ui/AdminState.jsx';
import { SeverityBadge } from '../components/ui/AdminState.jsx';

const MapPage = () => {
  const { data: clusters, isLoading, isError, error } = useClusters();
  const [selected, setSelected] = useState(null);

  const selectedId = selected?.clusterId || selected?.id || null;
  const list = clusters || [];

  const liveSelected =
    list.find(
      (c) =>
        selected &&
        (c.clusterId === selected.clusterId || c.id === selected.id)
    ) || selected;

  return (
    <section className="-m-5 flex h-[calc(100vh-3rem)] flex-col md:-m-6">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-admin-line bg-admin-panel/80 px-5 py-3 md:px-6">
        <div>
          <h2 className="admin-page-title">Map</h2>
          <p className="admin-page-sub">
            Active clusters — markers update live from the admin socket.
          </p>
        </div>
        <p className="font-mono text-[11px] text-admin-muted">
          {isLoading && !clusters
            ? 'loading…'
            : `${list.length} cluster${list.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {isError ? (
        <div className="px-5">
          <ErrorAlert error={error} fallback="Failed to load clusters" />
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-0 flex-1">
          {isLoading && !clusters ? (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-admin-panel/70">
              <LoadingNotice>Loading map clusters…</LoadingNotice>
            </div>
          ) : null}

          {!isLoading && !isError && list.length === 0 ? (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-admin-panel/80 px-6 text-center">
              <p className="text-sm text-admin-muted">
                No active clusters to plot. New reports will appear here live.
              </p>
            </div>
          ) : null}

          <ClusterMap
            clusters={list}
            selectedId={selectedId}
            onSelect={setSelected}
          />
          <SeverityLegend />
          <ClusterDetailDrawer
            cluster={liveSelected}
            onClose={() => setSelected(null)}
          />
        </div>

        {/* Keyboard-accessible cluster list (markers alone are mouse-only) */}
        <aside
          className="max-h-40 shrink-0 overflow-auto border-t border-admin-line bg-admin-panel lg:max-h-none lg:w-64 lg:border-l lg:border-t-0"
          aria-label="Cluster list"
        >
          <p className="sticky top-0 border-b border-admin-line bg-admin-panel px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-admin-muted">
            Clusters
          </p>
          {list.length === 0 && !isLoading ? (
            <p className="px-3 py-3 text-xs text-admin-muted">None active</p>
          ) : (
            <ul className="divide-y divide-admin-line">
              {list.map((cluster) => {
                const active =
                  selectedId === cluster.clusterId ||
                  selectedId === cluster.id;
                return (
                  <li key={cluster.id || cluster.clusterId}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelected(cluster)}
                      className={[
                        'flex w-full flex-col gap-1 px-3 py-2 text-left text-xs hover:bg-admin-surface',
                        active ? 'bg-admin-accent-soft' : '',
                      ].join(' ')}
                    >
                      <span className="font-mono text-admin-ink">
                        {cluster.clusterId}
                      </span>
                      <SeverityBadge severity={cluster.severity} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
};

export default MapPage;
