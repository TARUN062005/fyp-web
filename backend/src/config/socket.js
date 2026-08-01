import { Server } from 'socket.io';
import env from './env.js';
import { verifyAdminToken } from '../utils/jwt.js';
import AdminUser from '../models/AdminUser.js';

let io = null;
let adminNamespace = null;

const extractToken = (socket) => {
  const fromAuth = socket.handshake.auth?.token;
  if (fromAuth) return String(fromAuth);

  const header = socket.handshake.headers?.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  const fromQuery = socket.handshake.query?.token;
  if (fromQuery) return String(fromQuery);

  return null;
};

/**
 * Socket.IO attached to the HTTP server.
 * Only the `/admin` namespace accepts connections — gated by admin JWT
 * (same trust boundary as B4 HTTP admin auth). No mobile namespace yet.
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: env.adminOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Reject accidental connections on the default namespace
  io.on('connection', (socket) => {
    socket.disconnect(true);
  });

  adminNamespace = io.of('/admin');

  adminNamespace.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error('Unauthorized: admin JWT required'));
      }

      const decoded = verifyAdminToken(token);
      if (!decoded.adminId) {
        return next(new Error('Unauthorized: invalid admin token'));
      }

      const admin = await AdminUser.findById(decoded.adminId).select(
        '_id email role'
      );
      if (!admin) {
        return next(new Error('Unauthorized: admin not found'));
      }

      socket.admin = {
        adminId: String(admin._id),
        email: admin.email,
        role: admin.role,
      };
      return next();
    } catch {
      return next(new Error('Unauthorized: invalid admin token'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    console.log(
      `[socket:/admin] Connected ${socket.id} admin=${socket.admin.adminId}`
    );

    socket.on('disconnect', (reason) => {
      console.log(
        `[socket:/admin] Disconnected ${socket.id} reason=${reason}`
      );
    });
  });

  return io;
};

export const getIO = () => io;

export const getAdminNamespace = () => adminNamespace;
