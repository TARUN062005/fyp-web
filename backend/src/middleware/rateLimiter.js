import rateLimit from 'express-rate-limit';

/**
 * TRADEOFF — in-memory store only (express-rate-limit default MemoryStore).
 * Counters reset on process restart and are NOT shared across multiple
 * Node instances behind a load balancer. Acceptable for a single-instance
 * deployment; revisit with a shared store if this ever runs multi-instance.
 * No Redis in this project.
 */

const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const generalMax = Number(process.env.RATE_LIMIT_GENERAL_MAX) || 300;
const sensitiveMax = Number(process.env.RATE_LIMIT_SENSITIVE_MAX) || 20;

const jsonRateLimitHandler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    success: false,
    error: {
      message: options.message || 'Too many requests',
    },
  });
};

/** Broader per-IP limit for general API traffic */
export const generalRateLimiter = rateLimit({
  windowMs,
  max: generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  message: 'Too many requests, please try again later',
});

/**
 * Stricter per-IP limit for sensitive endpoints (Google auth, refresh).
 * Default MemoryStore — see tradeoff comment at top of this file.
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs,
  max: sensitiveMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
  message: 'Too many attempts on this endpoint, please try again later',
});
