import { asyncHandler } from '../utils/asyncHandler.js';
import { listConsensusUpdates, uploadVote } from '../services/voteService.js';

export const postVoteUpload = asyncHandler(async (req, res) => {
  const result = await uploadVote(req.body, req.user.userId);
  res.status(200).json({
    success: true,
    data: result,
  });
});

export const getConsensusUpdates = asyncHandler(async (req, res) => {
  const messageIds = req.query.messageIds
    ? String(req.query.messageIds)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;
  const result = await listConsensusUpdates({
    messageIds,
    since: req.query.since,
  });
  res.status(200).json({
    success: true,
    data: result,
  });
});
