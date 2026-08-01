import http from 'http';
import app from './app.js';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(env.port, () => {
      console.log(
        `[server] Running in ${env.nodeEnv} mode on port ${env.port}`
      );
    });
  } catch (error) {
    console.error('[server] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
