import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import env from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { getHealth } from './controllers/health.controller.js';
import indexRoutes from './routes/index.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import adminRoutes from './routes/admin.routes.js';
import broadcastRoutes from './routes/broadcast.routes.js';
import sosRoutes from './routes/sos.routes.js';
import clusterRoutes from './routes/cluster.routes.js';

const app = express();

app.use(helmet());

// Reflect only configured admin frontend origin(s) — never "*"
app.use(
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, mobile, server-to-server) may omit Origin
      if (!origin) {
        return callback(null, true);
      }
      if (env.adminOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(generalRateLimiter);

app.get('/health', getHealth);
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);
app.use('/broadcast', broadcastRoutes);
app.use('/sos', sosRoutes);
app.use('/clusters', clusterRoutes);
app.use('/api', indexRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
