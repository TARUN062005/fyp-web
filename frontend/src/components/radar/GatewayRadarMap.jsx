import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  connectionColor,
  formatCoord,
  resolveGatewayLatLng,
  resolvePeerLatLng,
} from '../../radar/radarGeo.js';

const DEFAULT_CENTER = [20.5937, 78.9629];
const PRECISE_ZOOM = 18;

const FollowGateway = ({ position, follow }) => {
  const map = useMap();
  const last = useRef(null);
  const gatewayKey = useRef(null);

  useEffect(() => {
    if (!position || !follow) return undefined;
    const key = `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
    if (gatewayKey.current !== key && !last.current) {
      map.setView(position, PRECISE_ZOOM, { animate: true });
      last.current = position;
      gatewayKey.current = key;
      return undefined;
    }
    if (!last.current) {
      last.current = position;
      gatewayKey.current = key;
      return undefined;
    }
    const moved = map.distance(last.current, position);
    if (moved >= 3) {
      map.panTo(position, { animate: true, duration: 0.75 });
      last.current = position;
      gatewayKey.current = key;
    }
    return undefined;
  }, [follow, map, position]);

  return null;
};

const MapGestures = ({ onUserPan }) => {
  useMapEvents({
    dragstart: () => onUserPan?.(),
  });
  return null;
};

const GatewayRadarMap = ({
  snapshot,
  selectedPeerId,
  onSelectPeer,
  stale = false,
}) => {
  const [follow, setFollow] = useState(true);
  const gateway = resolveGatewayLatLng(snapshot);
  const range = Number(snapshot?.radarRangeMeters) > 0
    ? Number(snapshot.radarRangeMeters)
    : 20;
  const accuracy = Number(snapshot?.observerAccuracyMeters);

  const plotted = useMemo(() => {
    if (!gateway) return [];
    return (snapshot?.peers || [])
      .map((peer) => {
        const resolved = resolvePeerLatLng(peer, gateway);
        if (!resolved) return null;
        return { peer, ...resolved };
      })
      .filter(Boolean);
  }, [gateway, snapshot?.peers]);

  const recenter = () => {
    setFollow(true);
  };

  if (!gateway) {
    return (
      <div className="flex h-[min(70vh,640px)] items-center justify-center bg-[#0f1720] px-6 text-center text-sm text-slate-300">
        Waiting for this gateway’s live GPS. Keep the Android app open with
        location permission so the website can place the user on the map.
      </div>
    );
  }

  return (
    <div className="relative h-[min(70vh,640px)] w-full overflow-hidden bg-[#0f1720]">
      <MapContainer
        center={gateway}
        zoom={PRECISE_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FollowGateway position={gateway} follow={follow} />
        <MapGestures onUserPan={() => setFollow(false)} />

        <Circle
          center={gateway}
          radius={range}
          pathOptions={{
            color: '#2dd4bf',
            weight: 1,
            fillColor: '#2dd4bf',
            fillOpacity: stale ? 0.04 : 0.08,
            dashArray: stale ? '4 6' : null,
          }}
        />
        {Number.isFinite(accuracy) && accuracy > 0 ? (
          <Circle
            center={gateway}
            radius={Math.min(accuracy, 80)}
            pathOptions={{
              color: '#38bdf8',
              weight: 1,
              fillColor: '#38bdf8',
              fillOpacity: 0.12,
            }}
          />
        ) : null}

        {plotted.map(({ peer, position }) => {
          if (peer.connectionState === 'DISCONNECTED') return null;
          return (
            <Polyline
              key={`link-${peer.peerId}`}
              positions={[gateway, position]}
              pathOptions={{
                color: connectionColor(peer.connectionState),
                weight: peer.connectionState === 'CONNECTED' ? 2.5 : 1.5,
                opacity: stale ? 0.35 : 0.7,
                dashArray: peer.connectionState === 'CONNECTED' ? null : '6 6',
              }}
            />
          );
        })}

        <CircleMarker
          center={gateway}
          radius={11}
          pathOptions={{
            color: '#0f172a',
            weight: 2,
            fillColor: '#2dd4bf',
            fillOpacity: stale ? 0.55 : 0.95,
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]}>
            <span className="font-mono text-[11px]">
              {snapshot?.displayName || 'Gateway'} · {formatCoord(gateway)}
            </span>
          </Tooltip>
        </CircleMarker>

        {plotted.map(({ peer, position, source }) => {
          const selected = selectedPeerId === peer.peerId;
          const color = connectionColor(peer.connectionState);
          return (
            <CircleMarker
              key={peer.peerId}
              center={position}
              radius={selected ? 10 : 7}
              pathOptions={{
                color: selected ? '#0f172a' : color,
                weight: selected ? 3 : 2,
                fillColor: color,
                fillOpacity: stale ? 0.45 : 0.9,
              }}
              eventHandlers={{
                click: () => onSelectPeer?.(peer),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-mono text-[11px]">
                  {peer.displayName} · {Number(peer.distanceMeters).toFixed(1)} m
                  {source === 'ESTIMATED' ? ' · est.' : ''}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded bg-white/90 px-2 py-1 font-mono text-[10px] text-slate-700 shadow">
        {formatCoord(gateway)}
        {Number.isFinite(accuracy) && accuracy > 0
          ? ` ±${accuracy.toFixed(1)} m`
          : ''}
      </div>
      <button
        type="button"
        className="absolute right-3 top-3 z-[500] rounded bg-white/95 px-2 py-1 text-xs font-medium text-slate-800 shadow"
        onClick={recenter}
      >
        Recenter
      </button>
    </div>
  );
};

export default GatewayRadarMap;
