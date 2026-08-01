import mongoose from 'mongoose';

const adminRefreshTokenSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      required: true,
      index: true,
    },
    /** JWT `jti` — stable key for revocation checks */
    jti: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'admin_refresh_tokens',
  }
);

adminRefreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
// TTL: MongoDB removes the document once expiresAt is in the past
adminRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminRefreshToken = mongoose.model(
  'AdminRefreshToken',
  adminRefreshTokenSchema
);

export default AdminRefreshToken;
