/**
 * Shared EmergencyReport → API DTO mapper (upload + admin + consensus).
 */
export const toEmergencyReportDto = (report) => {
  if (!report) return null;
  const uploaders = Array.isArray(report.uploaders)
    ? report.uploaders.map((id) => String(id))
    : [];
  const trueVotes = Number(report.trueVotes) || 0;
  const falseVotes = Number(report.falseVotes) || 0;
  const unknownVotes = Number(report.unknownVotes) || 0;
  const total = trueVotes + falseVotes + unknownVotes;
  const confidenceScore = Number(report.confidenceScore) || 0;

  return {
    id: String(report._id),
    messageId: report.messageId,
    originalSenderId: String(report.originalSenderId),
    uploaderId: String(report.uploaderId),
    uploaders,
    uploadCount: Number(report.uploadCount) || uploaders.length || 1,
    relayCount: Number(report.relayCount) || 0,
    hopCount: Number(report.hopCount) || 0,
    firstUploadedAt: report.firstUploadedAt || report.createdAt || null,
    lastUploadedAt: report.lastUploadedAt || report.createdAt || null,
    syncStatus: report.syncStatus || 'PENDING_CONSENSUS',
    trueVotes,
    falseVotes,
    unknownVotes,
    confidenceScore,
    verificationStatus: report.verificationStatus || 'UNVERIFIED',
    truePercent: total > 0 ? Math.round((trueVotes / total) * 1000) / 10 : 0,
    falsePercent: total > 0 ? Math.round((falseVotes / total) * 1000) / 10 : 0,
    unknownPercent:
      total > 0 ? Math.round((unknownVotes / total) * 1000) / 10 : 0,
    emergencyType: report.emergencyType,
    severity: report.severity,
    location: report.location,
    timestamp: report.timestamp,
    clusterId: report.clusterId ? String(report.clusterId) : null,
    createdAt: report.createdAt,
  };
};

export const recomputeRelayCount = (uploaders, originalSenderId) => {
  const origin = String(originalSenderId);
  return (uploaders || []).filter((id) => String(id) !== origin).length;
};

/**
 * Vote-based consensus (Phases 6–7).
 * confidenceScore = trueVotes / total (0 if no votes).
 */
export const computeVoteConsensus = ({
  trueVotes = 0,
  falseVotes = 0,
  unknownVotes = 0,
}) => {
  const t = Number(trueVotes) || 0;
  const f = Number(falseVotes) || 0;
  const u = Number(unknownVotes) || 0;
  const total = t + f + u;
  if (total === 0) {
    return {
      confidenceScore: 0,
      verificationStatus: 'UNVERIFIED',
    };
  }
  const confidenceScore = Math.min(1, Math.max(0, t / total));
  let verificationStatus = 'PARTIALLY_VERIFIED';
  if (confidenceScore >= 0.8) verificationStatus = 'VERIFIED';
  else if (confidenceScore <= 0.2) verificationStatus = 'FALSE_REPORT';
  return { confidenceScore, verificationStatus };
};
