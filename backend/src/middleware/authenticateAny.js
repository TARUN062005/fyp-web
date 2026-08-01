import { verifyToken, verifyAdminToken } from '../utils/jwt.js';
import User from '../models/User.js';
import AdminUser from '../models/AdminUser.js';

/**
 * Accepts either a mobile-user JWT (req.user) or an admin JWT (req.admin).
 * Used for read endpoints shared across trust boundaries (e.g. GET /clusters).
 */
export const authenticateAny = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('_id isBlocked');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not found' },
      });
    }
    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        error: { message: 'Account is blocked' },
      });
    }
    req.user = { userId: String(user._id) };
    req.authType = 'mobile';
    return next();
  } catch {
    // try admin below
  }

  try {
    const decoded = verifyAdminToken(token);
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
    req.authType = 'admin';
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token' },
    });
  }
};
