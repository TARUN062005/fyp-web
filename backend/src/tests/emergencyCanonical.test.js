import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLOUD_CANONICAL_VERSION,
  canonicalEmergencyCloudBytes,
  generateEmergencyKeyPair,
  signEmergencyCloud,
  verifyEmergencyCloudSignature,
} from '../security/emergencyCanonical.js';

describe('emergency cloud canonical', () => {
  it('matches the Android gold string (no content)', () => {
    const bytes = canonicalEmergencyCloudBytes({
      messageId: 'bc-1',
      senderId: 'phone-a',
      createdAtMs: 1_700_000_000_000,
      ttl: 86_400_000,
      radiusCanonical: '500.0',
      severity: 'CRITICAL',
      emergencyType: 'sos',
      latitudeCanonical: '12.9716',
      longitudeCanonical: '77.5946',
      batteryPercentage: 42,
      senderPublicKey: 'ed25519-origin-key',
    });
    const canonical = bytes.toString('utf8');
    assert.equal(canonical.startsWith(`${CLOUD_CANONICAL_VERSION}|`), true);
    assert.equal(
      canonical,
      'v1|bc-1|phone-a|1700000000000|86400000|500.0|CRITICAL|sos|12.9716|77.5946|42|ed25519-origin-key'
    );
    assert.equal(canonical.includes('PRIVATE'), false);
  });

  it('uses empty telemetry segments when omitted', () => {
    const canonical = canonicalEmergencyCloudBytes({
      messageId: 'bc-2',
      senderId: 'phone-b',
      createdAtMs: 2,
      ttl: 3,
      radiusCanonical: '1.5',
      severity: 'LOW',
      emergencyType: 'fire',
      latitudeCanonical: '',
      longitudeCanonical: '',
      senderPublicKey: 'pk',
    }).toString('utf8');
    assert.equal(canonical, 'v1|bc-2|phone-b|2|3|1.5|LOW|fire||||pk');
  });

  it('round-trips a real Ed25519 signature', () => {
    const keys = generateEmergencyKeyPair();
    const fields = {
      messageId: 'bc-sig',
      senderId: 'phone-a',
      createdAtMs: 1_700_000_000_000,
      ttl: 86_400_000,
      radiusCanonical: '500.0',
      severity: 'HIGH',
      emergencyType: 'flood',
      latitudeCanonical: '12.9716',
      longitudeCanonical: '77.5946',
      batteryPercentage: 10,
      senderPublicKey: keys.publicKeyBase64,
    };
    const signature = signEmergencyCloud(keys.privateKey, fields);
    const ok = verifyEmergencyCloudSignature({
      canonicalBytes: canonicalEmergencyCloudBytes(fields),
      signature,
      senderPublicKey: keys.publicKeyBase64,
    });
    assert.equal(ok, true);
  });
});
