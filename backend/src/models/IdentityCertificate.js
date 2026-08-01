import mongoose from 'mongoose';

const identityCertificateSchema = new mongoose.Schema(
  {
    emergencyId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^EDTN-[A-Z0-9]{5}$/, 'emergencyId must match EDTN-XXXXX'],
      index: true,
    },
    publicKey: {
      type: String,
      required: true,
    },
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    // Ed25519 signature from certificateService (server cert-signing key)
    serverSignature: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
    collection: 'identity_certificates',
  }
);

identityCertificateSchema.index({ emergencyId: 1, issuedAt: -1 });

const IdentityCertificate = mongoose.model(
  'IdentityCertificate',
  identityCertificateSchema
);

export default IdentityCertificate;
