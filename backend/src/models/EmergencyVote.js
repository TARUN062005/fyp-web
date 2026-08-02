import mongoose from 'mongoose';

export const VOTE_TYPE_VALUES = ['TRUE', 'FALSE', 'UNKNOWN'];

const emergencyVoteSchema = new mongoose.Schema(
  {
    voteId: {
      type: String,
      required: true,
      trim: true,
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    voteType: {
      type: String,
      required: true,
      uppercase: true,
      enum: VOTE_TYPE_VALUES,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: 'emergency_votes',
  }
);

emergencyVoteSchema.index({ messageId: 1, voterId: 1 }, { unique: true });
emergencyVoteSchema.index({ voteId: 1 }, { unique: true });

const EmergencyVote = mongoose.model('EmergencyVote', emergencyVoteSchema);

export default EmergencyVote;
