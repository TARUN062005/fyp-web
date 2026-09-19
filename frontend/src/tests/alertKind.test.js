import { describe, it, expect } from 'vitest';
import { alertKind, alertKindLabel, isSosType } from '../utils/alertKind.js';

describe('alertKind', () => {
  it('treats sos as SOS and other types as broadcast alerts', () => {
    expect(isSosType('sos')).toBe(true);
    expect(isSosType('SOS')).toBe(true);
    expect(isSosType('fire')).toBe(false);
    expect(alertKind('sos')).toBe('SOS');
    expect(alertKind('flood')).toBe('BROADCAST');
    expect(alertKindLabel('medical')).toBe('Broadcast alert');
    expect(alertKindLabel('sos')).toBe('SOS');
  });
});
