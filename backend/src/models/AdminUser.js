import mongoose from 'mongoose';

const ADMIN_ROLES = ['admin', 'superadmin'];

// Distinct trust boundary from mobile app User — never share that collection
const adminUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ADMIN_ROLES,
      default: 'admin',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'admin_users',
  }
);

adminUserSchema.index({ email: 1 }, { unique: true });

const AdminUser = mongoose.model('AdminUser', adminUserSchema);

export default AdminUser;
export { ADMIN_ROLES };
