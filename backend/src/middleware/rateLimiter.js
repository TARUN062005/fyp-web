/**
 * In-memory sliding-window limiters.
 *
 * Admin login stays unrestricted (ops console). Upload endpoints use
 * [uploadRateLimiter] so a stolen session cannot flood /sos/upload.
 */

const windowMs = () => Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const uploadMax = () => Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 30;
const sensitiveMax = () => Number(process.env.RATE_LIMIT_SENSITIVE_MAX) || 20;
const generalMax = () => Number(process.env.RATE_LIMIT_GENERAL_MAX) || 300;

const buckets = new Map();

const keyFor = (req, name) => {
  const user = req.user?.userId || req.user?.id || '';
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${name}:${user || ip}`;
};

const allow = (key, max, now = Date.now()) => {
  const win = windowMs();
  const hits = (buckets.get(key) || []).filter((t) => now - t < win);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
};

const reject = (res) =>
  res.status(429).json({
    success: false,
    message: 'Too many requests',
  });

export const generalRateLimiter = (req, res, next) => {
  if (allow(keyFor(req, 'general'), generalMax())) return next();
  return reject(res);
};

export const sensitiveRateLimiter = (req, res, next) => {
  if (allow(keyFor(req, 'sensitive'), sensitiveMax())) return next();
  return reject(res);
};

export const uploadRateLimiter = (req, res, next) => {
  if (allow(keyFor(req, 'upload'), uploadMax())) return next();
  return reject(res);
};

export const __resetRateLimiterForTests = () => {
  buckets.clear();
};
