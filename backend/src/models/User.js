import mongoose from 'mongoose';

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    googleAccountId: {
      type: String,
      trim: true,
    },
    emergencyId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^EDTN-[A-Z0-9]{5}$/, 'emergencyId must match EDTN-XXXXX'],
    },
    displayName: {
      type: String,
      trim: true,
      required: true,
    },
    /** Optional personal phone (PATCH /profile). Distinct from emergencyContact. */
    phoneNumber: {
      type: String,
      trim: true,
      default: null,
    },
    publicKey: {
      type: String,
      required: true,
    },
    publicKeyFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyContact: {
      type: emergencyContactSchema,
      default: undefined,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
    collection: 'users',
  }
);

// Unique indexes enforce one identity per Google account / emergencyId
userSchema.index({ googleAccountId: 1 }, { unique: true, sparse: true });
userSchema.index({ emergencyId: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);

export default User;
