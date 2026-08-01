/**
 * Live confirmation: expired access token → refresh → /admin/me succeeds
 * without requiring a new login.
 *
 * Usage: npm run verify:silent-refresh
 */
import http from 'http';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';
import app from '../app.js';
import AdminUser from '../models/AdminUser.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const getWithSilentRefresh = async (baseURL, session) => {
  const first = await fetch(`${baseURL}/admin/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  if (first.status !== 401) {
    return {
      response: first,
      body: await first.json(),
      session,
      refreshed: false,
    };
  }

  const refreshRes = await fetch(`${baseURL}/admin/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  assert(refreshRes.status === 200, `refresh failed: ${refreshRes.status}`);
  const refreshBody = await refreshRes.json();
  const next = {
    accessToken: refreshBody.data.accessToken,
    refreshToken: refreshBody.data.refreshToken,
  };

  const retry = await fetch(`${baseURL}/admin/me`, {
    headers: { Authorization: `Bearer ${next.accessToken}` },
  });
  const body = await retry.json();

  return { response: retry, body, session: next, refreshed: true };
};

const run = async () => {
  await mongoose.connect(env.mongoUri);

  const email = 'silent-refresh@dtnemergency.local';
  await AdminUser.deleteMany({ email });
  const admin = await AdminUser.create({
    email,
    passwordHash: await bcrypt.hash('SilentRefresh1!', 10),
    role: 'admin',
  });

  const pair = await issueAdminTokenPair(admin._id, admin.role);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseURL = `http://127.0.0.1:${port}`;

  const { response, body, session, refreshed } = await getWithSilentRefresh(
    baseURL,
    {
      accessToken: 'expired.or.invalid.access.token',
      refreshToken: pair.refreshToken,
    }
  );

  assert(refreshed, 'expected a refresh to occur');
  assert(response.status === 200, `expected 200, got ${response.status}`);
  assert(body?.data?.email === email, 'email mismatch');
  assert(
    session.accessToken !== 'expired.or.invalid.access.token',
    'access token not replaced'
  );
  assert(
    session.refreshToken !== pair.refreshToken,
    'refresh token not rotated'
  );

  console.log(
    '[verify] forced access-token expiry → silent refresh → /admin/me 200'
  );
  console.log('[verify] PASS — session continued without re-login');

  await AdminUser.deleteMany({ email });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
