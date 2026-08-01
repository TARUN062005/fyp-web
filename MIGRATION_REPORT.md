# Migration Report — Google-only authentication

**Date:** 2026-07-31  
**Scope:** Remove phone/OTP/Twilio auth; Google OAuth is the only mobile identity path.

---

## Summary

Mobile users now authenticate and restore identity exclusively via Google ID tokens. Permanent `emergencyId` allocation and IdentityCertificate (B4b) issuance are unchanged. Phone OTP, Twilio, pending tokens, and the `OtpChallenge` collection are gone.

---

## New authentication flow

1. Client obtains a Google ID token (or `mock:<googleAccountId>:<displayName>` in non-production when `GOOGLE_AUTH_MOCK=true`).
2. `POST /auth/google` with `{ idToken, publicKey?, publicKeyFingerprint? }`.
3. Backend verifies the token and looks up `User.googleAccountId`:
   - **Found** → status `restored`; issues JWT pair; optional new IdentityCertificate if `publicKey` changed.
   - **Not found** → requires `publicKey`; creates user with permanent `EDTN-XXXXX`, issues IdentityCertificate, status `created`.
4. Session refresh/logout remain `POST /auth/refresh` and `POST /auth/logout`.

Admin password login is unchanged (separate JWT secrets).

---

## Files changed

### Core auth
- `backend/src/services/authService.js` — Google-only create/restore
- `backend/src/controllers/auth.controller.js` — removed verify-phone handler
- `backend/src/routes/auth.routes.js` — removed `/verify-phone`
- `backend/src/validators/auth.validators.js` — removed phone/OTP schemas
- `backend/src/services/googleAuthService.js` — production-safe mock guard
- `backend/src/config/env.js` — Twilio/OTP removed from required vars; mock blocked in production
- `backend/src/models/User.js` — removed auth `phoneNumber` field + unique index
- `backend/src/models/index.js` — dropped `OtpChallenge` export
- `backend/src/services/adminOpsService.js` — public user DTO no longer exposes `phoneNumber`

### Enums / presence / logging
- `backend/src/config/emergencyEnums.js` — **new** severity + emergencyType enums
- `backend/src/validators/emergencyUpload.validators.js` — strict enum validation
- `backend/src/validators/adminOps.validators.js` — strict filter enums
- `backend/src/routes/cluster.routes.js` — strict `emergencyType` query enum
- `backend/src/models/EmergencyReport.js` / `EmergencyCluster.js` — mongoose `enum`
- `backend/src/middleware/touchPresence.js` — **new** presence middleware
- `backend/src/routes/profile.routes.js`, `broadcast.routes.js`, `sos.routes.js` — wire presence
- `backend/src/scripts/syncIndexes.js` — stop logging Mongo URI
- `backend/src/middleware/rateLimiter.js` — comment update

### Env / docs / deps
- `backend/.env.example`, `backend/.env` — Twilio/OTP vars removed
- `backend/package.json` / lockfile — `twilio` dependency removed
- `README.md` — env table updated
- Verify scripts under `backend/src/scripts/*` and `backend/src/tests/runCriticalSuite.js`

### Reports (this migration)
- `MIGRATION_REPORT.md` (this file)
- `SECURITY_FIX_REPORT.md`
- `UPDATED_ENV_SETUP.md`

---

## Code removed

| Path | Purpose |
|------|---------|
| `backend/src/services/otpService.js` | OTP facade |
| `backend/src/services/otp/devOtpProvider.js` | Dev OTP provider |
| `backend/src/services/otp/twilioOtpProvider.js` | Twilio SMS OTP |
| `backend/src/models/OtpChallenge.js` | OTP challenge collection |
| `POST /auth/verify-phone` | Send/verify OTP + phone identity |
| Pending JWT (`pending_phone_verification`) | Bridge from Google → phone |
| Env: `TWILIO_*`, `OTP_PROVIDER`, `OTP_DEV_LOG_CODE` | Twilio/OTP configuration |
| npm package `twilio` | SMS SDK |

---

## Breaking changes

| Change | Impact |
|--------|--------|
| `POST /auth/verify-phone` removed | Mobile clients must stop calling it |
| Google auth no longer returns `pending_phone_verification` / `pendingToken` | Clients must send `publicKey` on first signup in the same `/auth/google` call |
| Restore is Google-only | Phone number can no longer restore an identity |
| `User.phoneNumber` removed from schema / admin user API | Existing Mongo `phoneNumber` fields become unused; run `npm run sync-indexes` to drop the old unique index |
| Free-form `severity` / `emergencyType` rejected | Uploads must use enum values (see below) |
| Twilio env vars no longer accepted as required | Deploy configs must drop them |

### Allowed enums

- **severity:** `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`
- **emergencyType:** `sos` \| `fire` \| `flood` \| `medical` \| `collapse` \| `structural collapse` \| `other`

### Device presence

Authenticated mobile routes accept optional headers:

- `X-Device-Id` (required for presence updates)
- `X-App-Version` (optional)

---

## Security fixes (see SECURITY_FIX_REPORT.md)

- `GOOGLE_AUTH_MOCK` cannot run in production (boot fail + runtime guard).
- Device presence wired into authenticated mobile routes.
- Strict severity / emergencyType validation.
- Logging hygiene tightened (no Mongo URI in syncIndexes; OTP code logging removed with OTP stack).

---

## Remaining warnings

1. **Stale docs:** `ENV_SETUP.md` and `AUDIT_REPORT.md` still describe the pre-migration OTP/Twilio world. Prefer `UPDATED_ENV_SETUP.md` and this report.
2. **Legacy Mongo data:** Old `users.phoneNumber` values and `otp_challenges` collection may still exist until manually dropped.
3. **Emergency contact phones:** `User.emergencyContact.phoneNumber` remains as optional profile data (not used for auth).
4. **In-memory rate limits** still not shared across multiple Node instances.
5. **Android client** (outside this repo) must be updated for the Google-only signup contract.

---

## Suggested ops steps

```bash
cd backend
npm install
npm run sync-indexes   # drop old phoneNumber / otp indexes
# Optionally: db.otp_challenges.drop()
```
