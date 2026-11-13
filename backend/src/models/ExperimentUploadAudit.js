import mongoose from 'mongoose';

const experimentUploadAuditSchema = new mongoose.Schema(
  {
    experimentId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    deviceId: {
      type: String,
      default: '',
    },
    receivedCount: {
      type: Number,
      required: true,
    },
    insertedCount: {
      type: Number,
      required: true,
    },
    duplicateCount: {
      type: Number,
      required: true,
    },
    rejectedCount: {
      type: Number,
      required: true,
    },
    rejectedReasons: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

experimentUploadAuditSchema.index({ experimentId: 1, createdAt: -1 });

export default mongoose.model(
  'ExperimentUploadAudit',
  experimentUploadAuditSchema
);
