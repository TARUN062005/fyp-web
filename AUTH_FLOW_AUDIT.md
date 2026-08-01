# Auth Flow Audit — Google-only identity

**Date:** 2026-07-31  
**Scope:** Read-only inspection of the current backend (`backend/src`). No code was modified for this audit.

---

## Verdict (short)

| Question | Answer |
|----------|--------|
| 1. `POST /auth/verify-phone` removed? | **Yes** |
| 2. `phoneNumber` removed from User model (auth identity)? | **Yes** (top-level). Nested `emergencyContact.phoneNumber` remains as optional profile data only. |
| 3. New user via Google only? | **Yes** (`POST /auth/google` + `publicKey`) |
| 4. Existing user restore via Google only? | **Yes** (lookup by `googleAccountId`) |
| 5. `emergencyId` uniquely tied only to `googleAccountId`? | **Yes** for the mobile identity path |
| 6. IdentityCertificate still works without OTP? | **Yes** |
| 7. Remaining Twilio / phone-verification deps? | **None in backend runtime code** |

---

## 1. Has `POST /auth/verify-phone` been removed?

**Yes.**

Evidence:

- `backend/src/routes/auth.routes.js` mounts only:
  - `POST /auth/google`
  - `POST /auth/refresh`
  - `POST /auth/logout`
- `backend/src/controllers/auth.controller.js` exports only `googleAuth`, `refreshAuth`, `logoutAuth` — no `verifyPhone`.
- No `verifyPhoneBodySchema` in `backend/src/validators/auth.validators.js`.

---

## 2. Has `phoneNumber` been removed from the User model?

**Yes for authentication identity.**

Top-level `User.phoneNumber` is **not** present on `userSchema`. Unique indexes are only:

- `googleAccountId` (unique, sparse)
- `emergencyId` (unique)

**Caveat (non-auth):** `emergencyContact.phoneNumber` still exists inside an optional nested subdocument (`emergencyContactSchema`). That is emergency-contact profile data, not login/restore identity. It is unused by `authenticateWithGoogle`.

---

## 3. Can a brand-new user create an account using only Google OAuth?

**Yes.**

Flow in `authenticateWithGoogle` (`authService.js`):

1. Verify Google ID token → `googleAccountId`, `displayName`.
2. If no user with that `googleAccountId`:
   - Require `publicKey` (400 if missing).
   - Create user with permanent `EDTN-XXXXX`, `isVerified: true`.
   - Call `issueCertificate(emergencyId, publicKey)`.
   - Return `status: 'created'` + JWT pair + `identityCertificate`.

No phone OTP, pending token, or Twilio step is involved.

---

## 4. Can an existing user restore identity using only Google OAuth?

**Yes.**

Same endpoint:

1. Verify Google ID token.
2. `User.findOne({ googleAccountId })`.
3. If found → `status: 'restored'`, issue JWT pair, return existing `emergencyId` in profile.
4. If `publicKey` differs from stored key → reassociate + issue a new IdentityCertificate (reinstall path).

Restore does **not** use phone number.

Supporting script: `backend/src/scripts/verifyAuthRestore.js` exercises create-then-restore via Google mock tokens only.

---

## 5. Is `emergencyId` now uniquely tied only to `googleAccountId`?

**Yes, for the implemented mobile identity path.**

| Constraint | Role |
|------------|------|
| Unique sparse `googleAccountId` | One User row per Google subject |
| Unique `emergencyId` | One permanent EDTN id per User |
| Auth create path | Always sets both together |
| Auth restore path | Finds by `googleAccountId` only; returns that row’s `emergencyId` |

There is **no** phone-based alternate key for restore/create.

**Caveat:** `googleAccountId` is sparse (allows documents without it). The Google auth service always sets it; orphan rows without `googleAccountId` could only appear from non-auth writes/legacy data, not from the current Google signup path.

---

## 6. Is IdentityCertificate issuance still working after removing OTP?

**Yes — issuance is independent of OTP.**

- Create path: `issueCertificate(user.emergencyId, publicKey)` after User create.
- Reinstall/restore with new key: `reassociatePublicKeyIfNeeded` → `issueCertificate`.
- Certificate service (`certificateService.js`) signs with `CERT_SIGNING_PRIVATE_KEY`; no OTP imports.
- `GET /profile/certificate` still serves the latest cert for an authenticated user.
- Verify script `verifyCertificateReissue.js` still covers reissue after Google restore with a new `publicKey`.

OTP removal did not remove B4b certificate logic.

---

## 7. Are there any remaining dependencies on Twilio or phone verification?

**No runtime backend dependencies.**

| Area | Status |
|------|--------|
| `twilio` in `package.json` | Absent |
| `TWILIO_*` / `OTP_*` in `env.js` | Absent |
| `otpService` / `otp/` providers | Deleted (no files under `backend/src/services/otp`) |
| `OtpChallenge` model | Removed from `models/index.js` and filesystem |
| Auth routes / validators / controller | No phone/OTP paths |
| Grep of `backend/src` for Twilio/OTP auth | Only historical mention in `verifySecurityB10.js` asserting OTP files are **gone** |

**Non-blocking leftovers (not auth dependencies):**

- Optional nested `emergencyContact.phoneNumber` on User (profile).
- Stale documentation (`ENV_SETUP.md`, `AUDIT_REPORT.md`) still describing the old OTP flow.
- Possible legacy MongoDB data (`users.phoneNumber` field values, `otp_challenges` collection, old unique index) until ops cleanup / `sync-indexes`.

---

## Current mobile auth surface

```
POST /auth/google   { idToken, publicKey?, publicKeyFingerprint? }
POST /auth/refresh  { refreshToken }
POST /auth/logout   { refreshToken }
GET  /profile
GET  /profile/certificate
```

Admin login remains email/password (separate JWT secrets) and is out of scope for mobile Google identity.

---

## Files inspected

- `backend/src/routes/auth.routes.js`
- `backend/src/controllers/auth.controller.js`
- `backend/src/validators/auth.validators.js`
- `backend/src/services/authService.js`
- `backend/src/services/googleAuthService.js`
- `backend/src/services/certificateService.js`
- `backend/src/models/User.js`
- `backend/src/models/index.js`
- `backend/src/config/env.js`
- `backend/package.json`
- `backend/src/scripts/verifyAuthRestore.js`
- `backend/src/scripts/verifyCertificateReissue.js`

---

## Final status

### Google-only flow fully implemented

**Yes — for the backend mobile identity path.**

Create, restore, emergencyId binding, and IdentityCertificate issuance all run through Google OAuth only. Phone verification and Twilio are not part of the auth stack.

### Migration incomplete

**Partially incomplete only outside the auth code path:**

- Historical docs still mention OTP/Twilio.
- Legacy DB artifacts may still exist until index sync / collection drop.
- Android client (outside this repo) must call the new Google-only contract (`publicKey` on first `/auth/google`).

These do **not** mean the backend still requires phone auth.

### Remaining blockers

| Blocker | Severity | Notes |
|---------|----------|--------|
| Mobile/Android client not in this repo | Ops / client | Must stop calling `/auth/verify-phone` and send `publicKey` on first Google login |
| Legacy Mongo `phoneNumber` index / `otp_challenges` | Low | Run `npm run sync-indexes`; optionally drop old collection |
| Stale docs (`ENV_SETUP.md`, `AUDIT_REPORT.md`) | Low | Prefer `UPDATED_ENV_SETUP.md` / `MIGRATION_REPORT.md` |
| Valid `GOOGLE_CLIENT_ID` + Google ID tokens (or non-prod mock) | Config | Required for real Google login; not a phone/OTP dependency |
| `CERT_SIGNING_PRIVATE_KEY` configured | Config | Required for certificate issuance (unchanged B4b) |

**No remaining backend blockers that force phone verification or Twilio for identity.**
