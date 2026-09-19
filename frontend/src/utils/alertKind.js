/** SOS vs ordinary broadcast alert (cloud emergencyType). */
export const isSosType = (emergencyType) =>
  String(emergencyType || '').trim().toLowerCase() === 'sos';

export const alertKind = (emergencyType) =>
  isSosType(emergencyType) ? 'SOS' : 'BROADCAST';

export const alertKindLabel = (emergencyType) =>
  isSosType(emergencyType) ? 'SOS' : 'Broadcast alert';
