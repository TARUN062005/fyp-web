import AuditLog from '../models/AuditLog.js';

/**
 * Persist an AuditLog row. Safe to call from services or middleware.
 */
export const recordAuditLog = async ({
  adminId,
  action,
  targetType,
  targetId,
  metadata,
  timestamp = new Date(),
}) => {
  if (!adminId || !action || !targetType || targetId === undefined) {
    throw new Error('auditLog requires adminId, action, targetType, and targetId');
  }

  return AuditLog.create({
    adminId,
    action,
    targetType,
    targetId: String(targetId),
    timestamp,
    ...(metadata !== undefined ? { metadata } : {}),
  });
};

/**
 * Middleware wrapper for admin mutating routes.
 * Writes exactly one AuditLog on successful responses (status < 400),
 * before the JSON body is flushed — so clients never see success without
 * a corresponding audit row (best-effort; write errors are logged).
 *
 * Handlers may set `req.auditTarget = { targetType, targetId, metadata }`
 * to override resolveTarget after performing the mutation.
 *
 * @param {string} action - e.g. 'user.block'
 * @param {(req: import('express').Request) => { targetType: string, targetId: string|number, metadata?: object }} [resolveTarget]
 */
export const auditLog = (action, resolveTarget) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      const statusCode = res.statusCode || 200;

      if (statusCode >= 400 || !req.admin?.adminId) {
        return originalJson(body);
      }

      const writeAndRespond = async () => {
        try {
          let target = req.auditTarget;
          if (!target && typeof resolveTarget === 'function') {
            target = resolveTarget(req) || {};
          }
          target = target || {};

          const { targetType, targetId, metadata } = target;
          if (!targetType || targetId === undefined || targetId === null) {
            console.error(
              '[auditLog] missing targetType/targetId for action',
              action
            );
          } else {
            await recordAuditLog({
              adminId: req.admin.adminId,
              action,
              targetType,
              targetId,
              metadata,
            });
          }
        } catch (err) {
          console.error('[auditLog] failed to write entry:', err.message);
        }

        return originalJson(body);
      };

      return writeAndRespond();
    };

    next();
  };
};
