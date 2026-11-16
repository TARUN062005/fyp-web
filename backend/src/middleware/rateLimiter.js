/**
 * Rate limiting is disabled for lab / ops-console use.
 * In-memory counters were blocking admin sign-in during testing.
 */

export const generalRateLimiter = (req, res, next) => next();

export const sensitiveRateLimiter = (req, res, next) => next();
