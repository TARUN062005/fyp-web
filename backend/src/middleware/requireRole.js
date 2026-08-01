/**
 * Restrict an already-authenticated admin to one or more roles.
 * Use after authenticateAdmin. Supports future roles (e.g. moderator).
 *
 * @example
 * router.post('/block', authenticateAdmin, requireRole('admin', 'superadmin'), handler)
 */
export const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();

  return (req, res, next) => {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authorized' },
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient role' },
      });
    }

    return next();
  };
};
