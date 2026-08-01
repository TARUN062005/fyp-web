/**
 * Generate a server-owned Ed25519 keypair for IdentityCertificate signing.
 * Manual only — not exposed via any API.
 *
 * Usage:
 *   node scripts/generateCertSigningKeypair.js
 *   npm run generate:cert-keypair
 *
 * Copy the PRIVATE key into CERT_SIGNING_PRIVATE_KEY in .env / secrets manager.
 * Never commit the private key.
 *
 * ANDROID FOLLOW-UP: bake the PUBLIC key into the Android app so mesh peers
 * can verify IdentityCertificates offline.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keysDir = path.resolve(__dirname, '../keys');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).trim();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();

// Single-line env form (literal \n) for .env files
const privateEnv = privatePem.replace(/\r?\n/g, '\\n');

fs.mkdirSync(keysDir, { recursive: true });
const publicPath = path.join(keysDir, 'cert-signing-public.pem');
fs.writeFileSync(publicPath, `${publicPem}\n`, 'utf8');

console.log('=== CERT_SIGNING_PRIVATE_KEY (secret — never commit) ===');
console.log(privateEnv);
console.log('');
console.log('=== PUBLIC KEY (safe to ship to Android) ===');
console.log(publicPem);
console.log('');
console.log(`Public key also written to: ${publicPath}`);
console.log('');
console.log(
  'ANDROID FOLLOW-UP: embed this public key in the Android app to verify IdentityCertificates offline during mesh handshakes.'
);
