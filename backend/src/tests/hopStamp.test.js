import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateEmergencyKeyPair } from '../security/emergencyCanonical.js';
import {
  ORIGIN_PREV,
  hopStampHash,
  signHopStamp,
  verifyHopStampChain,
} from '../security/hopStamp.js';

describe('hop-stamp chain', () => {
  it('accepts origin plus one relay and rejects hop reset', () => {
    const origin = generateEmergencyKeyPair();
    const relay = generateEmergencyKeyPair();
    const messageId = 'msg-stamp';
    const originStamp = {
      hop: 0,
      relayId: 'alice',
      prevHash: ORIGIN_PREV,
      publicKey: origin.publicKeyBase64,
      signature: signHopStamp(origin.privateKey, messageId, 0, 'alice', ORIGIN_PREV),
    };
    const prevHash = hopStampHash(messageId, 0, 'alice', ORIGIN_PREV);
    const relayStamp = {
      hop: 1,
      relayId: 'bob',
      prevHash,
      publicKey: relay.publicKeyBase64,
      signature: signHopStamp(relay.privateKey, messageId, 1, 'bob', prevHash),
    };
    const chain = [originStamp, relayStamp];
    assert.equal(
      verifyHopStampChain({
        messageId,
        originId: 'alice',
        originPublicKey: origin.publicKeyBase64,
        stamps: chain,
        claimedHop: 1,
      }),
      true
    );
    assert.equal(
      verifyHopStampChain({
        messageId,
        originId: 'alice',
        originPublicKey: origin.publicKeyBase64,
        stamps: chain,
        claimedHop: 0,
      }),
      false
    );
  });
});
