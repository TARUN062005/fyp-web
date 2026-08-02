import mongoose from 'mongoose';
import EmergencyReport from '../models/EmergencyReport.js';
import EmergencyVote from '../models/EmergencyVote.js';
import { AppError } from '../utils/asyncHandler.js';
import { AdminSocketEvents, emitToAdmin } from './adminRealtime.js';
import {
  computeVoteConsensus,
  toEmergencyReportDto,
} from './emergencyReportDto.js';
import { emitToMobile } from './mobileRealtime.js';

const assertValidObjectId = (value, field) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`${field} must be a valid id`, 400);
  }
};

const recountVotes = async (messageId) => {
  const [trueVotes, falseVotes, unknownVotes] = await Promise.all([
    EmergencyVote.countDocuments({ messageId, voteType: 'TRUE' }),
    EmergencyVote.countDocuments({ messageId, voteType: 'FALSE' }),
    EmergencyVote.countDocuments({ messageId, voteType: 'UNKNOWN' }),
  ]);
  const { confidenceScore, verificationStatus } = computeVoteConsensus({
    trueVotes,
    falseVotes,
    unknownVotes,
  });

  const report = await EmergencyReport.findOneAndUpdate(
    { messageId },
    {
      $set: {
        trueVotes,
        falseVotes,
        unknownVotes,
        confidenceScore,
        verificationStatus,
        syncStatus: 'SYNCED',
      },
    },
    { new: true }
  );

  if (!report) {
    throw new AppError('Emergency report not found for this messageId', 404);
  }

  const dto = toEmergencyReportDto(report);
  const consensusPayload = {
    messageId: report.messageId,
    verificationStatus: report.verificationStatus,
    confidenceScore: report.confidenceScore,
    trueVotes: report.trueVotes,
    falseVotes: report.falseVotes,
    unknownVotes: report.unknownVotes,
    truePercent: dto.truePercent,
    falsePercent: dto.falsePercent,
    unknownPercent: dto.unknownPercent,
  };

  emitToAdmin(AdminSocketEvents.REPORT_CONSENSUS, {
    report: dto,
    consensus: consensusPayload,
  });
  emitToMobile('report:consensus', consensusPayload);

  return { report: dto, consensus: consensusPayload };
};

/**
 * Upsert a crowd vote. voterId must match the authenticated mobile user.
 */
export const uploadVote = async (payload, authenticatedUserId) => {
  const { voteId, voterId, messageId, voteType, timestamp } = payload;

  assertValidObjectId(voterId, 'voterId');
  if (String(voterId) !== String(authenticatedUserId)) {
    throw new AppError('voterId must match the authenticated user', 403);
  }

  const type = String(voteType || '').toUpperCase();
  if (!['TRUE', 'FALSE', 'UNKNOWN'].includes(type)) {
    throw new AppError('voteType must be TRUE, FALSE, or UNKNOWN', 400);
  }

  const report = await EmergencyReport.findOne({ messageId });
  if (!report) {
    throw new AppError('Emergency report not found for this messageId', 404);
  }

  const ts = new Date(timestamp);
  if (Number.isNaN(ts.getTime())) {
    throw new AppError('timestamp is invalid', 400);
  }

  const voterOid = new mongoose.Types.ObjectId(String(voterId));

  await EmergencyVote.findOneAndUpdate(
    { messageId, voterId: voterOid },
    {
      $set: {
        voteId,
        voterId: voterOid,
        messageId,
        voteType: type,
        timestamp: ts,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const { report: reportDto, consensus } = await recountVotes(messageId);

  return {
    vote: {
      voteId,
      voterId: String(voterId),
      messageId,
      voteType: type,
      timestamp: ts,
    },
    report: reportDto,
    consensus,
  };
};

/**
 * Consensus snapshots for mobile poll (messageIds filter or since timestamp).
 */
export const listConsensusUpdates = async ({ messageIds, since } = {}) => {
  const filter = {};
  if (Array.isArray(messageIds) && messageIds.length > 0) {
    filter.messageId = { $in: messageIds.slice(0, 200) };
  }
  if (since) {
    const sinceDate = new Date(since);
    if (!Number.isNaN(sinceDate.getTime())) {
      filter.lastUploadedAt = { $gte: sinceDate };
    }
  }

  const rows = await EmergencyReport.find(filter)
    .sort({ lastUploadedAt: -1 })
    .limit(200)
    .lean();

  return {
    updates: rows.map((r) => {
      const dto = toEmergencyReportDto(r);
      return {
        messageId: dto.messageId,
        verificationStatus: dto.verificationStatus,
        confidenceScore: dto.confidenceScore,
        trueVotes: dto.trueVotes,
        falseVotes: dto.falseVotes,
        unknownVotes: dto.unknownVotes,
        truePercent: dto.truePercent,
        falsePercent: dto.falsePercent,
        unknownPercent: dto.unknownPercent,
        uploadCount: dto.uploadCount,
        relayCount: dto.relayCount,
        hopCount: dto.hopCount,
        lastUploadedAt: dto.lastUploadedAt,
      };
    }),
  };
};
