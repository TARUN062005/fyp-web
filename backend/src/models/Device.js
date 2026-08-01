import mongoose from 'mongoose';

const DEVICE_STATUS = ['active', 'inactive', 'revoked'];

const deviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // App-generated install id — not a hardware identifier
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    appVersion: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: DEVICE_STATUS,
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'devices',
  }
);

deviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

const Device = mongoose.model('Device', deviceSchema);

export default Device;
export { DEVICE_STATUS };
