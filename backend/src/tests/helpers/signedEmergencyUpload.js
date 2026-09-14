/**
 * Shared signed emergency upload body for verify scripts and crypto tests.
 */
import {
  generateEmergencyKeyPair,
  signEmergencyCloud,
  fingerprintPublicKey,
} from '../../security/emergencyCanonical.js';

export { generateEmergencyKeyPair, fingerprintPublicKey };

const javaLikeDouble = (n) => {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return `${n}.0`;
  return String(n);
};

export const buildSignedEmergencyUpload = ({
  keyPair,
  messageId,
  senderId,
  originalSenderId,
  uploaderId,
  emergencyType = 'flood',
  severity = 'HIGH',
  longitude,
  latitude,
  timestampMs = Date.now(),
  ttl = 86_400_000,
  radius = 500,
  batteryPercentage = 42,
  hopCount = 0,
}) => {
  const body = {
    messageId,
    senderId,
    uploaderId,
    emergencyType,
    severity,
    location: { type: 'Point', coordinates: [longitude, latitude] },
    timestamp: new Date(timestampMs).toISOString(),
    createdAtMs: timestampMs,
    ttl,
    radiusCanonical: javaLikeDouble(radius),
    latitudeCanonical: javaLikeDouble(latitude),
    longitudeCanonical: javaLikeDouble(longitude),
    batteryPercentage,
    hopCount,
    senderPublicKey: keyPair.publicKeyBase64,
  };
  if (originalSenderId) {
    body.originalSenderId = originalSenderId;
  }
  body.signature = signEmergencyCloud(keyPair.privateKey, body);
  return body;
};
