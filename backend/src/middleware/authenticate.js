import { verifyToken } from '../utils/jwt.js';
import User from '../models/User.js';

/**
 * Verifies a mobile-user JWT and attaches req.user.
 * Rejects admin tokens (separate secret + typ claim).
 */
export const authenticate = async (req, res, next) => {
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
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid token' },
      });
    }

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
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token' },
    });
  }
};

/** @deprecated Prefer `authenticate` */
export const protect = authenticate;
