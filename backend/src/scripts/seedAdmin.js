/**
 * One-time bootstrap for the first AdminUser.
 * Manual only — not exposed via any HTTP API.
 *
 * Usage:
 *   node src/scripts/seedAdmin.js
 *   node src/scripts/seedAdmin.js --email admin@example.com --password 'secret'
 *   ADMIN_SEED_EMAIL=... ADMIN_SEED_PASSWORD=... node src/scripts/seedAdmin.js
 *
 * Or: npm run seed:admin
 */
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import env from '../config/env.js';
import AdminUser from '../models/AdminUser.js';

const BCRYPT_ROUNDS = 12;

const parseArgs = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--email') out.email = argv[i + 1];
    if (argv[i] === '--password') out.password = argv[i + 1];
    if (argv[i] === '--role') out.role = argv[i + 1];
  }
  return out;
};

const promptHidden = async (rl, question) => {
  // readline doesn't hide input cross-platform; warn and read normally
  output.write(
    '(password will be visible in this terminal — prefer --password or ADMIN_SEED_PASSWORD)\n'
  );
  return rl.question(question);
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const rl = readline.createInterface({ input, output });

  try {
    let email =
      args.email || process.env.ADMIN_SEED_EMAIL || (await rl.question('Admin email: '));
    email = String(email).trim().toLowerCase();

    let password =
      args.password ||
      process.env.ADMIN_SEED_PASSWORD ||
      (await promptHidden(rl, 'Admin password: '));
    password = String(password);

    const role = args.role || process.env.ADMIN_SEED_ROLE || 'superadmin';

    if (!email || !email.includes('@')) {
      throw new Error('A valid admin email is required');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!['admin', 'superadmin'].includes(role)) {
      throw new Error('role must be admin or superadmin');
    }

    await mongoose.connect(env.mongoUri);

    const existing = await AdminUser.findOne({ email });
    if (existing) {
      throw new Error(
        `AdminUser already exists for ${email}. Refusing to overwrite.`
      );
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const admin = await AdminUser.create({ email, passwordHash, role });

    console.log('[seedAdmin] Created AdminUser:');
    console.log(`  id:    ${admin._id}`);
    console.log(`  email: ${admin.email}`);
    console.log(`  role:  ${admin.role}`);
  } finally {
    rl.close();
    await mongoose.disconnect().catch(() => {});
  }
};

run().catch((err) => {
  console.error('[seedAdmin] Failed:', err.message);
  process.exit(1);
});
