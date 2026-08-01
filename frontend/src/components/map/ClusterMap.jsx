import { useEffect, useMemo, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { getSeverityColor, getSeverityMark } from '../../theme/severity.js';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;

const toLatLng = (cluster) => {
  const coords = cluster?.location?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

/** Fit once when the first markers arrive — do not jump on live updates. */
const FitBoundsOnce = ({ positions }) => {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !positions.length) return;
    fitted.current = true;
    if (positions.length === 1) {
      map.setView(positions[0], 12);
      return;
    }
    map.fitBounds(positions, { padding: [48, 48], maxZoom: 14 });
  }, [map, positions]);
  return null;
};

const ClusterMap = ({ clusters, selectedId, onSelect }) => {
  const markers = useMemo(
    () =>
      (clusters || [])
        .map((cluster) => {
          const position = toLatLng(cluster);
          if (!position) return null;
          return { cluster, position };
        })
        .filter(Boolean),
    [clusters]
  );

  const positions = markers.map((m) => m.position);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBoundsOnce positions={positions} />
      {markers.map(({ cluster, position }) => {
        const color = getSeverityColor(cluster.severity);
        const selected =
          selectedId &&
          (selectedId === cluster.clusterId || selectedId === cluster.id);
        return (
          <CircleMarker
            key={cluster.id || cluster.clusterId}
            center={position}
            radius={selected ? 12 : 9}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: selected ? 0.95 : 0.8,
              weight: selected ? 3 : 2,
            }}
            eventHandlers={{
              click: () => onSelect?.(cluster),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <span className="font-mono text-xs">
                {cluster.clusterId} · {getSeverityMark(cluster.severity)}{' '}
                {cluster.severity} · {cluster.status}
              </span>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
};

export default ClusterMap;
