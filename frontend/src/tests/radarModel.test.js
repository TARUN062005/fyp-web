import { describe, it, expect } from 'vitest';
import {
  formatAge,
  gatewayStatusFromAge,
  mergeGatewayList,
  shouldApplyRadarUpdate,
} from '../radar/radarModel.js';

describe('radarModel', () => {
  it('classifies live / stale / offline from age', () => {
    const now = 1_000_000;
    expect(gatewayStatusFromAge(now, now)).toBe('LIVE');
    expect(gatewayStatusFromAge(now - 21_000, now)).toBe('STALE');
    expect(gatewayStatusFromAge(now - 61_000, now)).toBe('OFFLINE');
    expect(gatewayStatusFromAge(null, now)).toBe('OFFLINE');
  });

  it('ignores radar updates for an unselected gateway', () => {
    expect(
      shouldApplyRadarUpdate('gw-c', { gatewayUserId: 'gw-f', peers: [] })
    ).toBe(false);
    expect(
      shouldApplyRadarUpdate('gw-c', { gatewayUserId: 'gw-c', peers: [] })
    ).toBe(true);
  });

  it('merges gateway status into the list', () => {
    const next = mergeGatewayList(
      [{ gatewayUserId: 'a', displayName: 'A', status: 'LIVE', peerCount: 1 }],
      { gatewayUserId: 'a', status: 'STALE', peerCount: 0 }
    );
    expect(next[0].status).toBe('STALE');
    expect(next[0].peerCount).toBe(0);
  });

  it('formats last-update age', () => {
    expect(formatAge(Date.now() - 2000, Date.now())).toMatch(/2 seconds ago/);
  });
});
