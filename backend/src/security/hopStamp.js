import crypto from 'crypto';
import { CryptoMaterialError, decodeEd25519PublicKey, decodeEd25519Signature } from './emergencyCanonical.js';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const ORIGIN_PREV = 'origin';

export const hopStampCanonical = (messageId, hop, relayId, prevHash) =>
  Buffer.from([messageId, String(hop), relayId, prevHash].join('|'), 'utf8');

export const hopStampHash = (messageId, hop, relayId, prevHash) =>
  crypto.createHash('sha256').update(hopStampCanonical(messageId, hop, relayId, prevHash)).digest('base64');

const verifySig = (canonicalBytes, signatureB64, publicKeyB64) => {
  const pub = decodeEd25519PublicKey(publicKeyB64);
  const sig = decodeEd25519Signature(signatureB64);
  const key = crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, pub]),
    format: 'der',
    type: 'spki',
  });
  return crypto.verify(null, canonicalBytes, key, sig);
};

export const verifyHopStampChain = ({
  messageId,
  originId,
  originPublicKey,
  stamps,
  claimedHop,
  maxHop = 5,
}) => {
  if (!Array.isArray(stamps) || stamps.length === 0) {
    throw new CryptoMaterialError('hopStamps required');
  }
  if (claimedHop !== stamps[stamps.length - 1].hop) return false;
  if (stamps.length - 1 > maxHop || claimedHop > maxHop) return false;
  if (stamps[0].hop !== 0) return false;
  if (stamps[0].relayId !== originId) return false;
  if (stamps[0].publicKey !== originPublicKey) return false;
  if (stamps[0].prevHash !== ORIGIN_PREV) return false;
  for (let i = 0; i < stamps.length; i += 1) {
    const stamp = stamps[i];
    if (stamp.hop !== i) return false;
    if (i > 0) {
      const prev = stamps[i - 1];
      const expected = hopStampHash(messageId, prev.hop, prev.relayId, prev.prevHash);
      if (stamp.prevHash !== expected) return false;
    }
    const canonical = hopStampCanonical(messageId, stamp.hop, stamp.relayId, stamp.prevHash);
    if (!verifySig(canonical, stamp.signature, stamp.publicKey)) return false;
  }
  return true;
};

export const signHopStamp = (privateKey, messageId, hop, relayId, prevHash) =>
  crypto.sign(null, hopStampCanonical(messageId, hop, relayId, prevHash), privateKey).toString('base64');

export { ORIGIN_PREV };
