import crypto from 'crypto';

/**
 * Metadata-only emergency cloud canonical.
 *
 * MUST stay identical to Android
 * `SignatureService.canonicalEmergencyCloudBytes`:
 *
 * v1|broadcastId|senderId|timestamp|ttl|radius|severity|emergencyType|lat|lng|battery|senderPublicKey
 *
 * Content / private chat is never included. Relays cannot change origin because
 * senderPublicKey is inside the signed bytes and the backend derives originalSenderId
 * from that verified key.
 */
export const CLOUD_CANONICAL_VERSION = 'v1';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export class CryptoMaterialError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CryptoMaterialError';
    this.code = 'MALFORMED_CRYPTO';
  }
}

const decodeExact = (value, expectedLength, label) => {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw new CryptoMaterialError(`${label} is required`);
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== expectedLength) {
    throw new CryptoMaterialError(
      `${label} is malformed (expected ${expectedLength} bytes)`
    );
  }
  return buf;
};

export const decodeEd25519PublicKey = (base64) =>
  decodeExact(base64, 32, 'senderPublicKey');

export const decodeEd25519Signature = (base64) =>
  decodeExact(base64, 64, 'signature');

export const canonicalEmergencyCloudBytes = ({
  messageId,
  senderId,
  createdAtMs,
  ttl,
  radiusCanonical,
  severity,
  emergencyType,
  latitudeCanonical,
  longitudeCanonical,
  batteryPercentage,
  senderPublicKey,
}) => {
  const battery =
    batteryPercentage === null ||
    batteryPercentage === undefined ||
    batteryPercentage === ''
      ? ''
      : String(batteryPercentage);
  const fields = [
    CLOUD_CANONICAL_VERSION,
    String(messageId),
    String(senderId),
    String(createdAtMs),
    String(ttl),
    String(radiusCanonical ?? ''),
    String(severity),
    String(emergencyType),
    String(latitudeCanonical ?? ''),
    String(longitudeCanonical ?? ''),
    battery,
    String(senderPublicKey ?? ''),
  ];
  return Buffer.from(fields.join('|'), 'utf8');
};

export const verifyEmergencyCloudSignature = ({
  canonicalBytes,
  signature,
  senderPublicKey,
}) => {
  const pub = decodeEd25519PublicKey(senderPublicKey);
  const sig = decodeEd25519Signature(signature);
  const key = crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, pub]),
    format: 'der',
    type: 'spki',
  });
  return crypto.verify(null, canonicalBytes, key, sig);
};

export const signEmergencyCloud = (privateKey, fields) => {
  const bytes = canonicalEmergencyCloudBytes(fields);
  return crypto.sign(null, bytes, privateKey).toString('base64');
};

export const generateEmergencyKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const raw = der.subarray(der.length - 32);
  return {
    privateKey,
    publicKeyBase64: raw.toString('base64'),
  };
};

export const fingerprintPublicKey = (publicKey) =>
  crypto.createHash('sha256').update(String(publicKey)).digest('hex');
