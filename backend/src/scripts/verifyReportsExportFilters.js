/**
 * Confirms GET /admin/reports/export returns the currently filtered set,
 * not the unfiltered full dataset.
 *
 * Usage: npm run verify:reports-export-filters
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import User from '../models/User.js';
import EmergencyReport from '../models/EmergencyReport.js';
import { issueAdminTokenPair } from '../services/adminTokenService.js';

const ADMIN_EMAIL = 'reports-export@dtnemergency.local';
const PREFIX = `rpt-exp-${Date.now()}`;

const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const run = async () => {
  await connectDB();

  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  const admin = await AdminUser.create({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash('ReportsExport1!', 10),
    role: 'admin',
  });
  const { accessToken } = await issueAdminTokenPair(admin._id, admin.role);
  const auth = { Authorization: `Bearer ${accessToken}` };

  const marker = `rpt-exp-user-${Date.now()}`;
  await User.deleteMany({ googleAccountId: marker });
  const user = await User.create({
    googleAccountId: marker,
    emergencyId: 'EDTN-RPEXP',
    displayName: 'Reports Export User',
    publicKey: `pk-${marker}`,
    publicKeyFingerprint: `fp-${marker}`,
    isVerified: true,
  });

  const now = Date.now();
  const docs = [
    {
      messageId: `${PREFIX}-high-in`,
      severity: 'HIGH',
      // Bangalore-ish
      coordinates: [77.5946, 12.9716],
      timestamp: new Date(now - 60_000),
    },
    {
      messageId: `${PREFIX}-medium-in`,
      severity: 'MEDIUM',
      coordinates: [77.6, 12.98],
      timestamp: new Date(now - 50_000),
    },
    {
      messageId: `${PREFIX}-high-out`,
      severity: 'HIGH',
      // Far away (Delhi-ish) — outside Bangalore bbox
      coordinates: [77.209, 28.6139],
      timestamp: new Date(now - 40_000),
    },
    {
      messageId: `${PREFIX}-low-old`,
      severity: 'LOW',
      coordinates: [77.59, 12.97],
      timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000),
    },
  ];

  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${PREFIX}`) });
  await EmergencyReport.insertMany(
    docs.map((d) => ({
      messageId: d.messageId,
      originalSenderId: user._id,
      uploaderId: user._id,
      emergencyType: 'other',
      severity: d.severity,
      location: { type: 'Point', coordinates: d.coordinates },
      timestamp: d.timestamp,
      clusterId: null,
    }))
  );

  const filters = {
    severity: 'HIGH',
    from: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    to: new Date(now + 60_000).toISOString(),
    minLng: 77.5,
    minLat: 12.9,
    maxLng: 77.7,
    maxLat: 13.1,
  };

  // Expected: only high-in (high-out fails bbox; medium fails severity; low-old fails date)
  const expectedIds = new Set([`${PREFIX}-high-in`]);

  const listRes = await request(app)
    .get('/admin/reports')
    .query({ ...filters, page: 1, limit: 50 })
    .set(auth);
  assert(listRes.status === 200, `list => ${listRes.status}`);
  const listed = listRes.body.data.reports || [];
  const listedIds = new Set(
    listed
      .map((r) => r.messageId)
      .filter((id) => String(id).startsWith(PREFIX))
  );
  assert(
    listedIds.size === expectedIds.size &&
      [...expectedIds].every((id) => listedIds.has(id)),
    `list mismatch: got [${[...listedIds]}] expected [${[...expectedIds]}]`
  );
  assert(
    listRes.body.data.total === expectedIds.size ||
      listed.filter((r) => String(r.messageId).startsWith(PREFIX)).length ===
        expectedIds.size,
    'list total for seeded rows unexpected'
  );
  console.log(
    `[verify] filtered list shows ${[...listedIds].join(', ')} ✓`
  );

  const exportRes = await request(app)
    .get('/admin/reports/export')
    .query({ ...filters, format: 'json' })
    .set(auth);
  assert(exportRes.status === 200, `export => ${exportRes.status}`);
  const exported = exportRes.body.data.reports || [];
  const exportedIds = new Set(
    exported
      .map((r) => r.messageId)
      .filter((id) => String(id).startsWith(PREFIX))
  );

  assert(
    exportedIds.size === expectedIds.size &&
      [...expectedIds].every((id) => exportedIds.has(id)),
    `export mismatch: got [${[...exportedIds]}] expected [${[...expectedIds]}]`
  );
  console.log('[verify] export JSON messageIds match filtered list ✓');

  // Unfiltered export of our seed prefix must be larger
  const fullExport = await request(app)
    .get('/admin/reports/export')
    .query({
      emergencyType: 'other',
      format: 'json',
    })
    .set(auth);
  assert(fullExport.status === 200, `full export => ${fullExport.status}`);
  const fullIds = (fullExport.body.data.reports || [])
    .map((r) => r.messageId)
    .filter((id) => String(id).startsWith(PREFIX));
  assert(fullIds.length === docs.length, `full export count=${fullIds.length}`);
  assert(
    exportedIds.size < fullIds.length,
    'filtered export was not smaller than unfiltered seed set'
  );
  assert(
    !exportedIds.has(`${PREFIX}-medium-in`),
    'export leaked MEDIUM row outside severity filter'
  );
  assert(
    !exportedIds.has(`${PREFIX}-high-out`),
    'export leaked HIGH row outside bbox'
  );
  assert(
    !exportedIds.has(`${PREFIX}-low-old`),
    'export leaked LOW row outside date range'
  );
  console.log(
    `[verify] filtered export (${exportedIds.size}) ⊂ unfiltered seed (${fullIds.length}) ✓`
  );

  // CSV path also respects filters
  const csvRes = await request(app)
    .get('/admin/reports/export')
    .query({ ...filters, format: 'csv' })
    .set(auth);
  assert(csvRes.status === 200, `csv export => ${csvRes.status}`);
  assert(
    String(csvRes.headers['content-type'] || '').includes('text/csv'),
    'csv content-type missing'
  );
  const csv = String(csvRes.text || csvRes.body || '');
  assert(csv.includes(`${PREFIX}-high-in`), 'csv missing expected row');
  assert(!csv.includes(`${PREFIX}-medium-in`), 'csv leaked medium row');
  assert(!csv.includes(`${PREFIX}-high-out`), 'csv leaked out-of-bbox row');
  console.log('[verify] CSV export respects the same filters ✓');

  console.log(
    '[verify] PASS — exported file matches filtered/displayed set, not full dataset'
  );

  await EmergencyReport.deleteMany({ messageId: new RegExp(`^${PREFIX}`) });
  await User.deleteMany({ googleAccountId: marker });
  await AdminUser.deleteMany({ email: ADMIN_EMAIL });
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[verify] FAIL:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
