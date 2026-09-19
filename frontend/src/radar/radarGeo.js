const EARTH_RADIUS_M = 6_378_137;

export const toLatLng = (point) => {
  const coords = point?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const lng = Number(coords[0]);
  const lat = Number(coords[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return [lat, lng];
};

export const formatCoord = ([lat, lng]) =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

/** 0° = north, clockwise. Same convention as the Android visual sector. */
export const offsetLatLng = ([lat, lng], distanceMeters, bearingDegrees) => {
  const dist = Number(distanceMeters);
  const bearing = Number(bearingDegrees);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Number.isFinite(dist) || dist < 0) return null;
  if (!Number.isFinite(bearing)) return null;
  if (dist === 0) return [lat, lng];
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lng * Math.PI) / 180;
  const brng = (bearing * Math.PI) / 180;
  const angular = dist / EARTH_RADIUS_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );
  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
};

export const resolveGatewayLatLng = (snapshot) =>
  toLatLng(snapshot?.observerLocation);

export const resolvePeerLatLng = (peer, gatewayLatLng) => {
  // Nearby mesh distances are RSSI/visual-sector estimates. Phone GPS is
  // typically ±10–20 m and would stretch a 1 m peer across the map.
  if (!gatewayLatLng) return null;
  const estimated = offsetLatLng(
    gatewayLatLng,
    peer?.distanceMeters,
    peer?.angleDegrees
  );
  if (!estimated) return null;
  return { position: estimated, source: 'ESTIMATED' };
};

export const haversineMeters = ([lat1, lng1], [lat2, lng2]) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const peerMapDistance = (peer, gatewayLatLng) => {
  const meters = Number(peer?.distanceMeters);
  if (!Number.isFinite(meters) || meters < 0) return null;
  return { meters, source: 'RSSI' };
};

export const formatDistanceLabel = (distance) => {
  if (!distance || !Number.isFinite(distance.meters)) return '—';
  const meters = distance.meters;
  const value =
    meters < 10 ? `${meters.toFixed(1)} m` : `${Math.round(meters)} m`;
  if (distance.source === 'GPS') return value;
  return `${value} (est.)`;
};

export const connectionColor = (state) => {
  if (state === 'CONNECTED') return '#22c55e';
  if (state === 'DISCOVERED') return '#f59e0b';
  return '#94a3b8';
};
