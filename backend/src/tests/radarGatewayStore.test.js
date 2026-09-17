import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  RADAR_OFFLINE_MS,
  RADAR_STALE_MS,
  collectStatusTransitions,
  computeRadarStatus,
  getRadarGateway,
  listRadarGateways,
  putRadarSnapshot,
  resetRadarStore,
} from '../services/radarGatewayStore.js';

const base = (overrides = {}) => ({
  gatewayUserId: '507f1f77bcf86cd799439011',
  displayName: 'Rahul',
  emergencyId: 'EDTN-AAAAA',
  sequence: 1,
  capturedAt: new Date().toISOString(),
  radarRangeMeters: 20,
  angleKind: 'VISUAL_SECTOR',
  peers: [
    {
      peerId: 'peer-a',
      displayName: 'Person A',
      connectionState: 'CONNECTED',
      distanceMeters: 18.4,
      beyondRadarRange: false,
      angleDegrees: 12,
    },
  ],
  ...overrides,
});

describe('radarGatewayStore', () => {
  beforeEach(() => {
    resetRadarStore();
  });

  it('does not list a gateway until a snapshot is published', () => {
    assert.equal(listRadarGateways().length, 0);
  });

  it('keeps two publishers as distinct gateways so the admin can switch', () => {
    const now = Date.now();
    putRadarSnapshot(base({ gatewayUserId: 'gw-a', displayName: 'A' }), now);
    putRadarSnapshot(
      base({ gatewayUserId: 'gw-b', displayName: 'B', sequence: 2 }),
      now
    );
    const list = listRadarGateways(now);
    assert.equal(list.length, 2);
    assert.equal(list.some((g) => g.gatewayUserId === 'gw-a'), true);
    assert.equal(list.some((g) => g.gatewayUserId === 'gw-b'), true);
  });

  it('stores a snapshot and lists the gateway as LIVE', () => {
    const now = Date.now();
    const result = putRadarSnapshot(base(), now);
    assert.equal(result.ok, true);
    assert.equal(result.duplicate, false);
    const list = listRadarGateways(now);
    assert.equal(list.length, 1);
    assert.equal(list[0].status, 'LIVE');
    assert.equal(list[0].peerCount, 1);
    const full = getRadarGateway(base().gatewayUserId, now);
    assert.equal(full.peers[0].displayName, 'Person A');
  });

  it('stores observer GeoJSON so admin Live Radar can plot a real map', () => {
    const now = Date.now();
    putRadarSnapshot(
      base({
        observerLocation: { type: 'Point', coordinates: [79.8612, 6.9271] },
        observerAccuracyMeters: 6.4,
        peers: [
          {
            peerId: 'peer-a',
            displayName: 'Person A',
            connectionState: 'CONNECTED',
            distanceMeters: 18.4,
            beyondRadarRange: false,
            angleDegrees: 12,
            location: { type: 'Point', coordinates: [79.8614, 6.9273] },
            locationSource: 'GPS',
          },
        ],
      }),
      now
    );
    const full = getRadarGateway(base().gatewayUserId, now);
    assert.deepEqual(full.observerLocation.coordinates, [79.8612, 6.9271]);
    assert.equal(full.observerAccuracyMeters, 6.4);
    assert.deepEqual(full.peers[0].location.coordinates, [79.8614, 6.9273]);
    const list = listRadarGateways(now);
    assert.deepEqual(list[0].observerLocation.coordinates, [79.8612, 6.9271]);
  });

  it('merges same sequence as duplicate without a second logical gateway', () => {
    const now = Date.now();
    putRadarSnapshot(base({ sequence: 4 }), now);
    const second = putRadarSnapshot(base({ sequence: 4 }), now + 100);
    assert.equal(second.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(listRadarGateways(now + 100).length, 1);
  });

  it('rejects a lower sequence while LIVE', () => {
    const now = Date.now();
    putRadarSnapshot(base({ sequence: 9 }), now);
    const rejected = putRadarSnapshot(base({ sequence: 3 }), now + 500);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.reason, 'stale_sequence');
  });

  it('accepts a restarted sequence after the gateway is stale', () => {
    const now = Date.now();
    putRadarSnapshot(base({ sequence: 40 }), now);
    const later = now + RADAR_STALE_MS + 1_000;
    const accepted = putRadarSnapshot(base({ sequence: 1 }), later);
    assert.equal(accepted.ok, true);
    assert.equal(accepted.duplicate, false);
    assert.equal(accepted.record.sequence, 1);
  });

  it('computes STALE then OFFLINE from age', () => {
    const now = Date.now();
    assert.equal(computeRadarStatus(now, now), 'LIVE');
    assert.equal(computeRadarStatus(now, now + RADAR_STALE_MS + 1), 'STALE');
    assert.equal(computeRadarStatus(now, now + RADAR_OFFLINE_MS + 1), 'OFFLINE');
  });

  it('emits status transitions when freshness is polled', () => {
    const now = Date.now();
    putRadarSnapshot(base(), now);
    const stale = collectStatusTransitions(now + RADAR_STALE_MS + 50);
    assert.equal(stale.length, 1);
    assert.equal(stale[0].status, 'STALE');
    const again = collectStatusTransitions(now + RADAR_STALE_MS + 50);
    assert.equal(again.length, 0);
  });
});
