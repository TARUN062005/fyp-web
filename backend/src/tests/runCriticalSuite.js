/**
 * Runs the six critical-path coverage suites and prints a coverage matrix.
 *
 * Usage: npm test
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

const suites = [
  {
    id: 1,
    area: 'Identity restore',
    detail: 'same Google account → same emergencyId across two installs',
    command: 'node',
    args: ['src/scripts/verifyAuthRestore.js'],
  },
  {
    id: 2,
    area: 'Idempotent upload',
    detail: 'duplicate messageId does not create a second EmergencyReport',
    command: 'node',
    args: ['src/scripts/verifyUploadIdempotency.js'],
  },
  {
    id: 3,
    area: 'Clustering',
    detail: 'merge within radius/time; no merge outside radius or time window',
    command: 'node',
    args: ['src/scripts/verifyClustering.js'],
  },
  {
    id: 4,
    area: 'Admin/mobile JWT separation',
    detail: 'mobile token rejected on admin routes and vice versa',
    command: 'node',
    args: ['src/scripts/verifyAdminBoundary.js'],
  },
  {
    id: 5,
    area: 'Rate limiting',
    detail: 'sensitive endpoints return 429 after threshold',
    command: 'node',
    args: ['src/scripts/verifyRateLimit.js'],
    env: {
      RATE_LIMIT_WINDOW_MS: '600000',
      RATE_LIMIT_SENSITIVE_MAX: '3',
      RATE_LIMIT_GENERAL_MAX: '1000',
    },
  },
  {
    id: 6,
    area: 'Certificate issuance',
    detail: 're-register with new publicKey issues a new IdentityCertificate',
    command: 'node',
    args: ['src/scripts/verifyCertificateReissue.js'],
  },
];

const runSuite = (suite) =>
  new Promise((resolve) => {
    const child = spawn(suite.command, suite.args, {
      cwd: backendRoot,
      env: { ...process.env, ...(suite.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on('close', (code) => {
      resolve({
        ...suite,
        pass: code === 0,
        code,
        stdout,
        stderr,
      });
    });
  });

const main = async () => {
  console.log('=== DTNEmergency critical-path test suite ===\n');
  const results = [];

  for (const suite of suites) {
    console.log(`\n--- [${suite.id}/6] ${suite.area} ---`);
    console.log(`    ${suite.detail}`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runSuite(suite);
    results.push(result);
    console.log(
      result.pass
        ? `>>> PASS [${suite.id}] ${suite.area}`
        : `>>> FAIL [${suite.id}] ${suite.area} (exit ${result.code})`
    );
  }

  console.log('\n=== Coverage matrix ===');
  console.log(
    `${'Area'.padEnd(32)} ${'Covered'.padEnd(10)} Result`
  );
  console.log('-'.repeat(56));
  for (const r of results) {
    console.log(
      `${r.area.padEnd(32)} ${'yes'.padEnd(10)} ${r.pass ? 'PASS' : 'FAIL'}`
    );
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  console.log('-'.repeat(56));
  console.log(`Total: ${passed} passed, ${failed} failed (of ${results.length})`);

  if (failed > 0) {
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('Suite runner failed:', err.message);
  process.exit(1);
});
