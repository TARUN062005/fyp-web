import mongoose from 'mongoose';
import env from './env.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const connectDB = async () => {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await mongoose.connect(env.mongoUri);
      console.log('[db] MongoDB connected');
      return mongoose.connection;
    } catch (error) {
      attempt += 1;
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);

      console.error(
        `[db] Connection attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`
      );

      if (attempt >= MAX_RETRIES) {
        throw new Error(
          `[db] Could not connect to MongoDB after ${MAX_RETRIES} attempts`
        );
      }

      console.log(`[db] Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
};

export const getDbStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const readyState = mongoose.connection.readyState;
  return {
    readyState,
    status: states[readyState] ?? 'unknown',
    connected: readyState === 1,
  };
};
