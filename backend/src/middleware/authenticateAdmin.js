import { verifyAdminToken } from '../utils/jwt.js';
import AdminUser from '../models/AdminUser.js';

/**
 * Verifies an admin JWT and attaches req.admin.
 * Mobile-user tokens are rejected outright (different secret + typ).
 */
export const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAdminToken(token);
    if (!decoded.adminId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid admin token' },
      });
    }

    const admin = await AdminUser.findById(decoded.adminId).select(
      '_id email role'
    );
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: { message: 'Admin not found' },
      });
    }

    req.admin = {
      adminId: String(admin._id),
      email: admin.email,
      role: admin.role,
    };
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid admin token' },
    });
  }
};

/** @deprecated Prefer `authenticateAdmin` */
export const protectAdmin = authenticateAdmin;
