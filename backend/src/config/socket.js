import { Server } from 'socket.io';
import mongoose from 'mongoose';
import env from './env.js';
import { verifyAdminToken, verifyToken } from '../utils/jwt.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import {
  AdminSocketEvents,
  radarRoomName,
} from '../services/adminRealtime.js';
import { getRadarGateway } from '../services/radarGatewayStore.js';
import { startRadarFreshnessMonitor } from '../services/radarService.js';

let io = null;
let adminNamespace = null;
let mobileNamespace = null;

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
 * - `/admin` — admin JWT
 * - `/mobile` — mobile user JWT (consensus push)
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

    const leaveRadarRooms = () => {
      for (const room of socket.rooms) {
        if (String(room).startsWith('radar:')) {
          socket.leave(room);
        }
      }
    };

    socket.on('radar:subscribe', (payload = {}) => {
      const gatewayUserId = String(payload.gatewayUserId || '').trim();
      if (!mongoose.Types.ObjectId.isValid(gatewayUserId)) {
        socket.emit('radar:error', { message: 'invalid gatewayUserId' });
        return;
      }
      leaveRadarRooms();
      socket.join(radarRoomName(gatewayUserId));
      const current = getRadarGateway(gatewayUserId);
      if (current) {
        socket.emit(AdminSocketEvents.RADAR_GATEWAY_UPDATED, {
          ...current,
          emittedAt: new Date().toISOString(),
        });
      } else {
        socket.emit(AdminSocketEvents.RADAR_GATEWAY_STATUS, {
          gatewayUserId,
          status: 'OFFLINE',
          lastUpdatedAt: null,
          peerCount: 0,
          emittedAt: new Date().toISOString(),
        });
      }
    });

    socket.on('radar:unsubscribe', (payload = {}) => {
      const gatewayUserId = String(payload.gatewayUserId || '').trim();
      if (gatewayUserId) {
        socket.leave(radarRoomName(gatewayUserId));
      } else {
        leaveRadarRooms();
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(
        `[socket:/admin] Disconnected ${socket.id} reason=${reason}`
      );
    });
  });

  startRadarFreshnessMonitor();

  mobileNamespace = io.of('/mobile');

  mobileNamespace.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error('Unauthorized: mobile JWT required'));
      }

      const decoded = verifyToken(token);
      if (!decoded.userId) {
        return next(new Error('Unauthorized: invalid mobile token'));
      }

      const user = await User.findById(decoded.userId).select('_id isBlocked');
      if (!user) {
        return next(new Error('Unauthorized: user not found'));
      }
      if (user.isBlocked) {
        return next(new Error('Forbidden: account blocked'));
      }

      socket.user = { userId: String(user._id) };
      return next();
    } catch {
      return next(new Error('Unauthorized: invalid mobile token'));
    }
  });

  mobileNamespace.on('connection', (socket) => {
    console.log(
      `[socket:/mobile] Connected ${socket.id} user=${socket.user.userId}`
    );
    socket.on('disconnect', (reason) => {
      console.log(
        `[socket:/mobile] Disconnected ${socket.id} reason=${reason}`
      );
    });
  });

  return io;
};

export const getIO = () => io;

export const getAdminNamespace = () => adminNamespace;

export const getMobileNamespace = () => mobileNamespace;
