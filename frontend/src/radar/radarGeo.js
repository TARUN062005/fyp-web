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
  const gps = toLatLng(peer?.location);
  if (gps) {
    return { position: gps, source: peer.locationSource === 'ESTIMATED' ? 'ESTIMATED' : 'GPS' };
  }
  if (!gatewayLatLng) return null;
  const estimated = offsetLatLng(
    gatewayLatLng,
    peer?.distanceMeters,
    peer?.angleDegrees
  );
  if (!estimated) return null;
  return { position: estimated, source: 'ESTIMATED' };
};

export const connectionColor = (state) => {
  if (state === 'CONNECTED') return '#22c55e';
  if (state === 'DISCOVERED') return '#f59e0b';
  return '#94a3b8';
};
