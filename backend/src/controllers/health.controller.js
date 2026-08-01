import { getDbStatus } from '../config/db.js';

export const getHealth = (_req, res) => {
  const db = getDbStatus();
  const healthy = db.connected;

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'degraded',
    server: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    database: {
      status: db.status,
      connected: db.connected,
    },
  });
};
