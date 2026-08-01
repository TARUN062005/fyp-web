# Updated environment setup (post Google-only migration)

**Date:** 2026-07-31  
**Canonical guide** for backend/frontend env after removing Twilio/OTP.  
Supersedes the Twilio/OTP sections of `ENV_SETUP.md`.

---

## Required variables (backend)

Set these in `backend/.env` (see `backend/.env.example`). Server **exits on boot** if any required value is missing/blank.

| Variable | Purpose |
|----------|---------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Mobile access JWT secret |
| `JWT_REFRESH_SECRET` | Mobile refresh JWT secret |
| `ADMIN_JWT_SECRET` | Admin access JWT secret (**must ≠** `JWT_SECRET`) |
| `ADMIN_JWT_REFRESH_SECRET` | Admin refresh JWT secret (**must ≠** `JWT_REFRESH_SECRET`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (`aud` of mobile ID tokens) |
| `CERT_SIGNING_PRIVATE_KEY` | Ed25519 private key PEM for IdentityCertificates |
| `ADMIN_ORIGIN` | Admin SPA origin(s), comma-separated — never `*` |
| `NODE_ENV` | `development` or `production` (defaults to `development` if unset) |

---

## Removed variables (do not set)

| Variable | Status |
|----------|--------|
| `TWILIO_ACCOUNT_SID` | **Removed** |
| `TWILIO_AUTH_TOKEN` | **Removed** |
| `TWILIO_PHONE_NUMBER` | **Removed** |
| `OTP_PROVIDER` | **Removed** |
| `OTP_DEV_LOG_CODE` | **Removed** |
| Any phone-auth-only env | **Removed** |

---

## Optional variables

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `5000` | HTTP listen port |
| `JWT_EXPIRES_IN` | `15m` | Mobile access TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Mobile refresh TTL |
| `ADMIN_JWT_EXPIRES_IN` | `15m` | Admin access TTL |
| `ADMIN_JWT_REFRESH_EXPIRES_IN` | `7d` | Admin refresh TTL |
| `CERT_SIGNING_PUBLIC_KEY` | _(empty)_ | Useful for local verify scripts; bake into Android |
| `GOOGLE_AUTH_MOCK` | `false` | `true` only when **not** production; accepts `mock:<googleAccountId>:<displayName>` |
| `RATE_LIMIT_*` | see `.env.example` | In-memory limiter tunables |
| `DEVICE_ONLINE_WINDOW_MS` | `900000` | Presence online window |
| Clustering knobs | see `clustering.js` | `CLUSTER_RADIUS_METERS`, etc. |

**Production rule:** if `NODE_ENV=production` and `GOOGLE_AUTH_MOCK=true`, the process **refuses to start**.

---

## Frontend env

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SOCKET_URL` | Socket.IO URL |

Do **not** put Mongo/JWT/cert secrets in frontend env.

---

## New authentication flow

```
Android / client
  → Google Sign-In → idToken
  → POST /auth/google { idToken, publicKey, publicKeyFingerprint? }
  → { status: "created" | "restored", accessToken, refreshToken, profile, identityCertificate? }
```

- **Restore:** same Google account → same permanent `emergencyId`.
- **Create:** new Google account + `publicKey` → new `EDTN-XXXXX` + IdentityCertificate.
- **Removed:** `POST /auth/verify-phone`, OTP, Twilio, `pendingToken`.

Optional presence headers on authenticated mobile calls:

- `X-Device-Id`
- `X-App-Version`

---

## Files changed (env surface)

- `backend/src/config/env.js`
- `backend/.env.example`
- `backend/.env` (local template — replace secrets)
- `README.md`
- Reports: `MIGRATION_REPORT.md`, `SECURITY_FIX_REPORT.md`, this file

---

## Code removed (env-related)

- Twilio credential loading
- `OTP_PROVIDER` / OTP provider selection
- Twilio npm dependency

---

## Breaking changes

1. Deployments that only set Twilio placeholders must switch to the required list above (no Twilio).
2. Mobile clients must complete identity on `/auth/google` (with `publicKey` for new users).
3. `GOOGLE_AUTH_MOCK=true` in production is a hard failure.

---

## Security fixes reflected in env

- Mock Google auth gated by `NODE_ENV !== "production"`.
- No SMS secrets in the process environment.
- Cert private key still required and must never be committed.

---

## Remaining warnings

1. Replace placeholder values in `backend/.env` with real Atlas URI, JWT secrets, Google client ID, and cert key before running.
2. After upgrade, run `npm run sync-indexes` so Mongo drops the obsolete `phoneNumber` unique index.
3. Optionally drop collection `otp_challenges` if it still exists from older builds.
4. `ENV_SETUP.md` / `AUDIT_REPORT.md` may still mention Twilio — treat them as historical unless updated.

---

## Quick start checklist

1. Copy `backend/.env.example` → `backend/.env`
2. Set `MONGO_URI`, four JWT secrets, `GOOGLE_CLIENT_ID`, `CERT_SIGNING_PRIVATE_KEY`, `ADMIN_ORIGIN`, `NODE_ENV`
3. `npm run generate:cert-keypair` if you need a new Ed25519 pair
4. `npm run seed:admin -- --email ... --password ...`
5. `npm run sync-indexes`
6. `npm run dev`
