/**
 * Confirms Socket.IO `/admin` namespace accepts a valid admin JWT and
 * rejects missing/invalid tokens.
 *
 * Usage: npm run verify:admin-socket
 */
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { io as ioc } from 'socket.io-client';
import env from '../config/env.js';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import { initSocket } from '../config/socket.js';
import AdminUser from '../models/AdminUser.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'socket-admin@dtnemergency.local';

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const connectAttempt = (url, auth, timeoutMs = 4000) =>
  new Promise((resolve) => {
    const socket = ioc(url, {
      auth,
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      timeout: timeoutMs,
    });

    const done = (result) => {
      socket.removeAllListeners();
      socket.close();
      resolve(result);
    };

    socket.on('connect', () => done({ ok: true, id: socket.id }));
    socket.on('connect_error', (err) =>
      done({ ok: false, message: err.message })
    );
    setTimeout(
      () => done({ ok: false, message: 'timeout waiting for connect' }),
      timeoutMs + 500
    );
  });

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('SocketAdminPass1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);

  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const adminUrl = `http://127.0.0.1:${port}/admin`;

  const valid = await connectAttempt(adminUrl, { token: accessToken });
  assert(valid.ok, `valid JWT should connect, got: ${valid.message}`);
  console.log(`[verify] valid admin JWT => connected (${valid.id}) ✓`);

  const missing = await connectAttempt(adminUrl, {});
  assert(!missing.ok, 'missing JWT should be rejected');
  console.log(`[verify] missing JWT => rejected (${missing.message}) ✓`);

  const invalid = await connectAttempt(adminUrl, { token: 'not.a.jwt' });
  assert(!invalid.ok, 'invalid JWT should be rejected');
  console.log(`[verify] invalid JWT => rejected (${invalid.message}) ✓`);

  // Mobile-shaped token must not work on admin namespace
  const { generateToken } = await import('../utils/jwt.js');
  const mobileToken = generateToken({ userId: String(admin._id) });
  const mobile = await connectAttempt(adminUrl, { token: mobileToken });
  assert(!mobile.ok, 'mobile JWT should be rejected on /admin');
  console.log(`[verify] mobile JWT => rejected (${mobile.message}) ✓`);

  console.log('[verify] PASS — admin namespace JWT gate works');

  await new Promise((resolve) => server.close(resolve));
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
