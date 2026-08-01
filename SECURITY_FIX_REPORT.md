# Security Fix Report

**Date:** 2026-07-31  
**Context:** Critical audit issues + removal of phone/OTP attack surface.

---

## Summary

Production mock-auth bypass is blocked, device presence is wired, upload/query enums are strict, OTP/Twilio code is deleted, and logging no longer depends on OTP providers that could leak codes.

---

## Security fixes

### 1. `GOOGLE_AUTH_MOCK` cannot run in production

**Before:** `GOOGLE_AUTH_MOCK=true` accepted `mock:<id>:<name>` tokens in any `NODE_ENV`.

**After:**
- Boot fails if `NODE_ENV=production` and `GOOGLE_AUTH_MOCK=true` (`env.js`).
- Runtime mock path only when:

```js
process.env.NODE_ENV !== 'production' &&
process.env.GOOGLE_AUTH_MOCK === 'true'
```

**Files:** `backend/src/config/env.js`, `backend/src/services/googleAuthService.js`

---

### 2. Device presence wired

**Before:** `touchDevicePresence` existed but was never called from routes.

**After:** `touchPresence` middleware runs after mobile `authenticate` on:

- `GET /profile`, `GET /profile/certificate`
- `POST /broadcast/upload`
- `POST /sos/upload`

Clients send `X-Device-Id` (+ optional `X-App-Version`). Failures are non-blocking.

**Files:** `backend/src/middleware/touchPresence.js`, profile/broadcast/sos routes

---

### 3. Strict enum validation

**Before:** Free-form `severity` / `emergencyType` strings on uploads and many filters.

**After:** Zod + Mongoose enums:

| Field | Values |
|-------|--------|
| `severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `emergencyType` | `sos`, `fire`, `flood`, `medical`, `collapse`, `structural collapse`, `other` |

**Files:** `backend/src/config/emergencyEnums.js`, upload/admin/cluster validators, EmergencyReport/EmergencyCluster models

---

### 4. Sensitive logging

| Change | Detail |
|--------|--------|
| OTP stack removed | No more OTP code logging path |
| `syncIndexes` | Logs “Connected to MongoDB” — not the URI (credentials) |
| `requestLogger` | Still method/path/status/latency only |
| `errorHandler` | Still avoids bodies/tokens/coords |

**Files:** deleted OTP providers; `backend/src/scripts/syncIndexes.js`

---

### 5. OTP / Twilio attack surface removed

- No SMS OTP send endpoint.
- No Twilio credentials required or loaded.
- No `OtpChallenge` storage of hashed codes.
- No phone-based identity restore / account linking races.

---

## Files changed (security-relevant)

- `backend/src/config/env.js`
- `backend/src/services/googleAuthService.js`
- `backend/src/services/authService.js`
- `backend/src/middleware/touchPresence.js`
- `backend/src/routes/{profile,broadcast,sos}.routes.js`
- `backend/src/config/emergencyEnums.js`
- `backend/src/validators/emergencyUpload.validators.js`
- `backend/src/validators/adminOps.validators.js`
- `backend/src/models/{User,EmergencyReport,EmergencyCluster,index}.js`
- Deleted: `otpService.js`, `otp/*`, `OtpChallenge.js`
- `backend/package.json` (no `twilio`)

---

## Code removed

OTP service/providers, Twilio integration, verify-phone route/controller/validators, pending-phone JWT, User auth phoneNumber field, Twilio/OTP env vars.

---

## New authentication flow (security view)

Google ID token → verify audience → unique `googleAccountId` → restore or create with permanent `emergencyId` + Ed25519 IdentityCertificate → JWT access/refresh (hashed refresh storage, revocation). No SMS second factor.

---

## Breaking changes

- Clients must not call `/auth/verify-phone`.
- First-time Google signup requires `publicKey` on `/auth/google`.
- Invalid severity/emergencyType → `400` validation errors.
- Production deployments with `GOOGLE_AUTH_MOCK=true` will refuse to start.

---

## Remaining warnings

1. Rate limiting remains in-memory (single-instance only).
2. Legacy `otp_challenges` / `phoneNumber` indexes may linger until `sync-indexes` / manual drop.
3. Admin password auth strength depends on seed/password policy (unchanged).
4. Historical docs (`AUDIT_REPORT.md`, old `ENV_SETUP.md`) are outdated relative to these fixes.
5. Presence updates require clients to send `X-Device-Id`; without it, devices stay stale/offline.
