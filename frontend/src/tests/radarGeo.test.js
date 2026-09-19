import { describe, it, expect } from 'vitest';
import {
  formatCoord,
  formatDistanceLabel,
  offsetLatLng,
  peerMapDistance,
  resolvePeerLatLng,
  toLatLng,
} from '../radar/radarGeo.js';

describe('radarGeo', () => {
  it('reads GeoJSON as Leaflet [lat, lng]', () => {
    expect(toLatLng({ type: 'Point', coordinates: [79.8612, 6.9271] })).toEqual([
      6.9271, 79.8612,
    ]);
  });

  it('offsets one kilometer north', () => {
    const dest = offsetLatLng([6.0, 80.0], 1000, 0);
    expect(dest[1]).toBeCloseTo(80.0, 3);
    expect(dest[0]).toBeCloseTo(6.00899, 4);
  });

  it('places one-meter Nearby peers from RSSI not GPS', () => {
    const gateway = [6.9271, 79.8612];
    const peer = {
      location: { coordinates: [79.8614, 6.9273] },
      locationSource: 'GPS',
      distanceMeters: 1,
      angleDegrees: 0,
    };
    const resolved = resolvePeerLatLng(peer, gateway);
    expect(resolved.source).toBe('ESTIMATED');
    const distance = peerMapDistance(peer, gateway);
    expect(distance.source).toBe('RSSI');
    expect(distance.meters).toBe(1);
    expect(formatDistanceLabel(distance)).toMatch(/1\.0 m/);
  });

  it('estimates around the gateway when GPS is missing', () => {
    const resolved = resolvePeerLatLng(
      { distanceMeters: 100, angleDegrees: 0, connectionState: 'CONNECTED' },
      [6.9271, 79.8612]
    );
    expect(resolved.source).toBe('ESTIMATED');
    expect(resolved.position[0]).toBeGreaterThan(6.9271);
    expect(resolved.position[1]).toBeCloseTo(79.8612, 4);
  });

  it('formats high-precision coordinates', () => {
    expect(formatCoord([6.9271234, 79.8612567])).toBe('6.927123, 79.861257');
  });

  it('uses RSSI meters even when GPS is ~20 m away', () => {
    const gateway = [6.9271, 79.8612];
    const peer = {
      location: { coordinates: [79.86122, 6.92712] },
      locationSource: 'GPS',
      distanceMeters: 1,
      beyondRadarRange: false,
    };
    const distance = peerMapDistance(peer, gateway);
    expect(distance.source).toBe('RSSI');
    expect(distance.meters).toBe(1);
    expect(formatDistanceLabel(distance)).not.toMatch(/>20/);
  });
});
