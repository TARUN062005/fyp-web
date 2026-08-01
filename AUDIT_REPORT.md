# DTNEmergency Control Center — Full Codebase Audit Report

**Date:** 2026-07-31  
**Scope:** `backend/` + `frontend/` (read-only audit; no application code changed for this report)  
**Project type:** MERN final-year project — mobile emergency DTN backend + admin ops console  

---

## Executive summary

The project has matured well beyond a scaffold. The backend implements a clear dual trust boundary (mobile vs admin JWT), identity restore with Sybil-resistant unique indexes, Ed25519 identity certificates, idempotent emergency uploads, geo/time clustering with Socket.IO admin realtime, and a full admin ops API surface. The frontend admin console covers dashboard, map, clusters, users, reports, analytics, devices, and audit logs with React Query and live socket patches.

**It is suitable for continued development and local demos.** It is **not** production-ready without addressing mock-auth guards, device presence wiring, OTP/env hardening, and deployment packaging.

| Score | Value |
|-------|-------|
| Overall architecture | **8 / 10** |
| Security | **7 / 10** |
| Production readiness | **6 / 10** |
| **Final verdict** | **Needs fixes** (ready for **development / local demo**; not ready for production deploy) |

---

## 1. Folder structure and architecture

**Status:** PASS (with WARNING)

### Structure

```
finalyearprojectweb/
  backend/
    src/
      app.js, server.js
      config/       env, db, socket, clustering
      controllers/
      middleware/
      models/
      routes/
      services/     (+ otp/)
      validators/
      scripts/      verify* + syncIndexes
      tests/        runCriticalSuite.js
      repositories/ (empty .gitkeep only)
    scripts/        seedAdmin, generateCertSigningKeypair
  frontend/
    src/
      pages/, components/, hooks/, services/, store/, layouts/, theme/, tests/
```

### Problems found

| Severity | Problem | Files | Suggested fix |
|----------|---------|-------|---------------|
| WARNING | Empty `repositories/` layer unused | `backend/src/repositories/` | Remove or implement repository pattern |
| WARNING | Root README still says “scaffold… no business logic” | `README.md` L3 | Update docs to match implemented system |
| WARNING | No Docker / compose packaging | project root | Add Dockerfile + docker-compose for Mongo/API/UI if deploying |

### Security / performance

- Layering (routes → controllers → services → models) is clear — good maintainability.
- Clustering runs synchronously inside the upload request path — may add latency under load (`emergencyUploadService.js` awaits clustering).

---

## 2. Backend routes and API endpoints

**Status:** PASS

### Public / health

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | public |
| GET | `/api/` | public (stub) |

### Mobile auth & profile

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/google` | public + sensitive rate limit |
| POST | `/auth/verify-phone` | public + sensitive rate limit |
| POST | `/auth/refresh` | public + sensitive rate limit |
| POST | `/auth/logout` | public |
| GET | `/profile` | mobile JWT |
| GET | `/profile/certificate` | mobile JWT |

### Emergency / clusters

| Method | Path | Auth |
|--------|------|------|
| POST | `/broadcast/upload` | mobile JWT |
| POST | `/sos/upload` | mobile JWT |
| GET | `/clusters` | mobile **or** admin JWT |

### Admin

| Method | Path | Auth |
|--------|------|------|
| POST | `/admin/auth/login` | public + sensitive RL |
| POST | `/admin/auth/refresh` | public + sensitive RL |
| POST | `/admin/auth/logout` | public |
| GET | `/admin/me` | admin |
| POST | `/admin/block-user` | admin + audit |
| POST | `/admin/unblock-user` | admin + audit |
| POST | `/admin/verify-cluster` | admin + audit |
| POST | `/admin/merge-clusters` | admin + audit |
| GET | `/admin/reports` | admin |
| GET | `/admin/reports/export` | admin |
| GET | `/admin/audit-logs` | admin |
| GET | `/admin/devices` | admin |
| GET | `/admin/users` | admin |
| GET | `/admin/dashboard-summary` | admin |
| GET | `/admin/analytics` | admin |

### Problems found

| Severity | Problem | Files | Suggested fix |
|----------|---------|-------|---------------|
| WARNING | `/api/` is a placeholder | `backend/src/routes/index.js` | Document or remove |
| WARNING | `GET /admin/me` unused by frontend | `admin.routes.js` | Wire session restore or document as optional |

Mounting evidence: `backend/src/app.js` L44–51.

---

## 3. MongoDB schemas and indexes

**Status:** PASS (WARNING on OTP TTL / cert history)

| Model | Collection | Key indexes |
|-------|------------|-------------|
| User | `users` | unique sparse `googleAccountId`, `phoneNumber`; unique `emergencyId` |
| Device | `devices` | unique `{userId, deviceId}` |
| AdminUser | `admin_users` | unique `email` |
| RefreshToken | `refresh_tokens` | unique `jti`, `tokenHash`; TTL on `expiresAt` |
| AdminRefreshToken | `admin_refresh_tokens` | same as refresh |
| IdentityCertificate | `identity_certificates` | `{emergencyId, issuedAt}` — no “current only” unique |
| OtpChallenge | `otp_challenges` | `{phoneNumber, createdAt}`; `expiresAt` indexed but **not TTL** |
| EmergencyReport | `emergency_reports` | unique `messageId`; `2dsphere` location |
| EmergencyCluster | `emergency_clusters` | unique `clusterId`; `2dsphere` |
| AuditLog | `audit_logs` | adminId/action/target/timestamp indexes |

### Problems found

| Severity | Problem | Files / lines | Suggested fix | Risk |
|----------|---------|---------------|---------------|------|
| WARNING | OTP challenges have no TTL auto-delete | `OtpChallenge.js` L15–18, L35 | Add `expireAfterSeconds: 0` on `expiresAt` | DB growth, leftover hashes |
| WARNING | Certificates accumulate; no revocation flag | `IdentityCertificate` model + `certificateService.js` | Mark previous certs revoked / “current” pointer | Stale keys if clients don’t check latest |
| PASS | Sybil uniqueness via sparse unique indexes | `User.js` | — | — |
| PASS | Upload idempotency via unique `messageId` | `EmergencyReport.js` | — | — |

---

## 4. JWT authentication and authorization

**Status:** PASS

### Design

- **Mobile:** `JWT_SECRET` / `JWT_REFRESH_SECRET`, claim `typ: "mobile"` (`backend/src/utils/jwt.js`).
- **Admin:** separate `ADMIN_JWT_*` secrets, claim `typ: "admin"`.
- Startup refuses identical mobile/admin secrets (`backend/src/config/env.js` L34–42).
- Refresh tokens: hashed SHA-256, `jti`, rotate-on-use, TTL indexes.
- Middleware: `authenticate`, `authenticateAdmin`, `authenticateAny`, `requireRole`.
- Blocked mobile users rejected on authenticated mobile routes.

### Problems found

| Severity | Problem | Files | Suggested fix | Risk |
|----------|---------|-------|---------------|------|
| WARNING | Refresh rotate not fully atomic | `tokenService.js` / `adminTokenService.js` | Conditional update / reuse detection | Concurrent refresh race |
| WARNING | Frontend holds tokens in JS memory | `frontend/src/store/authStore.js` L3–8 | Longer-term: httpOnly cookies + CSRF | XSS can steal tokens while tab open |
| PASS | Dual trust boundary | verified by `verify:admin-boundary` | — | — |

---

## 5. Google OAuth flow

**Status:** WARNING (FAIL if deployed with mock enabled)

### Flow

1. `POST /auth/google` with Google ID token.
2. `verifyGoogleIdToken` (`googleAuthService.js` L12–48) uses `google-auth-library` with `GOOGLE_CLIENT_ID`.
3. Existing Google user → restore session; else → `pendingToken` for phone verification.

### Problems found

| Severity | Problem | Files / lines | Suggested fix | Security risk |
|----------|---------|---------------|---------------|---------------|
| **FAIL** (prod) | `GOOGLE_AUTH_MOCK=true` accepts `mock:<id>:<name>` in **any** `NODE_ENV` | `googleAuthService.js` L17–27; `env.js` L85 | Refuse start if `NODE_ENV=production && GOOGLE_AUTH_MOCK` | Full authentication bypass |
| PASS | Real path verifies audience against client ID | `googleAuthService.js` L31–34 | — | — |

---

## 6. OTP flow

**Status:** PASS (WARNING on validation / env)

### Flow

- `OTP_PROVIDER=dev` (default) or `twilio`.
- `POST /auth/verify-phone` without `otp` = send; with `otp` + `pendingToken` = verify.
- Challenges stored hashed; max attempts; 10m expiry in service logic.
- Dev code logging gated by `OTP_DEV_LOG_CODE` and non-production.

### Problems found

| Severity | Problem | Files | Suggested fix | Risk |
|----------|---------|-------|---------------|------|
| WARNING | Twilio env vars always required even for `OTP_PROVIDER=dev` | `env.js` L12–14 | Require Twilio only when provider is `twilio` | Ops friction / fake secrets |
| WARNING | Phone validation is weak (`min(5)`) | `auth.validators.js` | Enforce E.164 | SMS abuse cost |
| WARNING | OTP send not tightly bound to a valid pending Google session in all paths | auth controllers/validators | Require valid `pendingToken` for send | Unsolicited OTP spam |
| PASS | Sensitive rate limiter on auth/OTP routes | `auth.routes.js` + `rateLimiter.js` | — | — |

---

## 7. Identity restore logic

**Status:** PASS

### Logic (`authService.js` — verify phone resolve)

1. Verify pending JWT + OTP.  
2. Match by phone → restore (conflict if phone linked to another Google).  
3. Else match by Google → restore.  
4. Else create user with unique `EDTN-XXXXX` + issue certificate.  
5. Unique-index races → restore raced identity.  
6. Public key change → reissue certificate.

### Problems found

| Severity | Problem | Suggested fix |
|----------|---------|---------------|
| WARNING | Public key / fingerprint format not cryptographically validated | Validate PEM + fingerprint consistency before save |
| PASS | Sybil model via unique sparse indexes | — |

---

## 8. Identity certificate implementation

**Status:** PASS

### Design

- Ed25519 signing with `CERT_SIGNING_PRIVATE_KEY` (`certificateService.js`).
- Canonical payload signed → `base64url` signature.
- Served at `GET /profile/certificate`.
- Keygen helper: `npm run generate:cert-keypair`.

### Problems found

| Severity | Problem | Suggested fix |
|----------|---------|---------------|
| WARNING | Historical certs not revoked | Soft-revoke previous on reissue |
| WARNING | Public key optional on server | Document that mobile embeds public key; keep server verify helper optional |

---

## 9. Emergency upload APIs

**Status:** PASS (WARNING on validation)

### Design

- Shared handler for `/broadcast/upload` and `/sos/upload`.
- Mobile JWT required; `uploaderId` must match caller.
- Idempotent on `messageId`.
- Timestamp window (48h past / 15m future skew).
- Emits `report:created`, then clustering.

### Problems found

| Severity | Problem | Files | Suggested fix | Risk |
|----------|---------|-------|---------------|------|
| WARNING | Free-form `emergencyType` / `severity` | `emergencyUpload.validators.js` | Enum allow-list | Junk clusters / scoring noise |
| WARNING | `originalSenderId` not proven to exist | `emergencyUploadService.js` | Existence check + relay policy | Spoofed attribution |
| WARNING | Upload uses general rate limit only | `app.js` / upload routes | Per-user upload limiter | Flooding |
| PASS | Idempotency + unique index | covered by verify script | — | — |

---

## 10. Clustering engine

**Status:** PASS

### Design (`clusteringService.js` + `config/clustering.js`)

- `$geoNear` same type, active status, radius default **500m**, time window **2h**.
- Confidence from count + proximity.
- Severity: never below max sender severity; escalation score with type profiles (sos/fire escalate faster).
- Emits `cluster:created` / `cluster:updated` (with previous severity/count).

### Problems found

| Severity | Problem | Suggested fix | Performance |
|----------|---------|---------------|-------------|
| WARNING | Clustering awaited inline on upload | Background queue for high load | Request latency |
| WARNING | Merge clusters without multi-doc transaction | Use transactions on replica set | Partial merge under crash |
| PASS | Severity escalation + live map color path verified | — | — |

---

## 11. Socket.IO events

**Status:** PASS (WARNING: device events unwired)

### Design

- Namespace `/admin` only; default namespace rejected.
- Auth: admin JWT handshake.
- CORS = `ADMIN_ORIGIN` allow-list.
- Events: `report:created`, `cluster:created|updated|verified|merged`, `device:status`, `user:blocked|unblocked`.

### Problems found

| Severity | Problem | Files | Suggested fix |
|----------|---------|-------|---------------|
| **FAIL** (feature completeness) | `touchDevicePresence` is never called from routes/auth/upload | `devicePresenceService.js` L28+ (only definition) | Wire on login/upload/heartbeat |
| PASS | Admin JWT gate on `/admin` namespace | `config/socket.js` | — |

---

## 12. Admin APIs

**Status:** PASS

- Login/refresh/logout with separate admin token store.
- Mutating routes write AuditLog via middleware.
- Reports (filter + export), users (filter/search), devices (presence window), analytics aggregates, dashboard summary, cluster verify/merge.

### Problems found

| Severity | Problem | Suggested fix |
|----------|---------|---------------|
| WARNING | Admin password schema allows `min(1)` | Align validator with seed (min 8+) |
| PASS | Audit attribution for block/unblock/verify/merge verified | `verify:f5-f6-audit` |

---

## 13. Frontend pages and routing

**Status:** PASS

### Routes (`frontend/src/App.jsx`)

| Path | Page |
|------|------|
| `/login` | LoginPage |
| `/dashboard` | DashboardPage |
| `/map` | MapPage |
| `/clusters` | ClustersPage |
| `/clusters/:clusterId` | ClusterDetailPage |
| `/users` | UsersPage |
| `/reports` | ReportsPage |
| `/analytics` | AnalyticsPage |
| `/devices` | DevicesPage |
| `/audit-logs` | AuditLogsPage |

### Auth UX

- In-memory Zustand session (no localStorage).
- Axios silent refresh on 401.
- Full page reload requires re-login (by design).
- Admin socket patches dashboard + clusters caches.

### Problems found

| Severity | Problem | Files / lines | Suggested fix |
|----------|---------|---------------|---------------|
| WARNING | Catch-all `*` redirects to `/dashboard` | `App.jsx` ~L35 | Prefer 404 or `/login` |
| WARNING | `GET /admin/me` unused | — | Optional session restore |
| WARNING | Large production bundle (~900KB+ JS) | Vite default single chunk | `manualChunks` for leaflet/recharts |
| WARNING | `VITE_*` fallbacks to localhost | `frontend/src/utils/env.js` L8–9 | Fail build if missing in production |
| PASS | Admin API surface largely covered by UI | services under `frontend/src/services/` | — |

---

## 14. Security issues

**Status:** WARNING (critical item: mock Google in production)

| Severity | Issue | Location | Suggested fix |
|----------|-------|----------|---------------|
| **FAIL** | Mock Google auth not production-blocked | `googleAuthService.js` L17–27 | Hard-fail boot in production if mock enabled |
| WARNING | In-memory rate limits (not multi-instance) | `rateLimiter.js` | Document single-node; Redis store if scaled; `trust proxy` |
| WARNING | Tokens in memory / JSON refresh body | frontend auth + API | Cookie+CSRF roadmap |
| WARNING | Free-form emergency severity/type | upload validators | Enums |
| WARNING | Weak phone / admin password validation | validators | E.164 + stronger admin password |
| WARNING | `syncIndexes` may log full Mongo URI | `syncIndexes.js` | Redact credentials |
| PASS | CORS never `*` | `env.js` L60–65; `app.js` L22–37 | — |
| PASS | Helmet enabled | `app.js` L20 | — |
| PASS | Dual JWT secrets required distinct | `env.js` L34–42 | — |
| PASS | No `dangerouslySetInnerHTML` in frontend | grep | — |

---

## 15. Missing validations

**Status:** WARNING

| Area | Gap | Suggested fix |
|------|-----|---------------|
| Upload | Free-form severity / emergencyType | Zod enums aligned with clustering |
| Upload | `originalSenderId` existence | Lookup User |
| OTP | Phone format | E.164 |
| Admin auth | Password strength | min length / complexity |
| Public keys | Format/fingerprint match | Validate before persist |
| JSON body | Default Express limit only | Explicit size limit |

---

## 16. Environment variables

**Status:** PASS (WARNING on Twilio always required)

### Backend required (`backend/src/config/env.js` L5–17)

1. `MONGO_URI`  
2. `JWT_SECRET`  
3. `JWT_REFRESH_SECRET`  
4. `ADMIN_JWT_SECRET`  
5. `ADMIN_JWT_REFRESH_SECRET`  
6. `GOOGLE_CLIENT_ID`  
7. `TWILIO_ACCOUNT_SID`  
8. `TWILIO_AUTH_TOKEN`  
9. `TWILIO_PHONE_NUMBER`  
10. `ADMIN_ORIGIN`  
11. `CERT_SIGNING_PRIVATE_KEY`  

### Backend optional / important

- `OTP_PROVIDER` (`dev` \| `twilio`)  
- `GOOGLE_AUTH_MOCK`  
- `CERT_SIGNING_PUBLIC_KEY`  
- `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, admin equivalents  
- `DEVICE_ONLINE_WINDOW_MS`  
- `CLUSTER_RADIUS_METERS`, `CLUSTER_TIME_WINDOW_MS`  
- Rate limit overrides  
- Admin seed vars  

### Frontend

- `VITE_API_URL`  
- `VITE_SOCKET_URL`  

See also: `backend/.env.example`, `frontend/.env.example`.

---

## 17. CORS configuration

**Status:** PASS

- Allow-list from `ADMIN_ORIGIN` (comma-separated).  
- Explicit reject of `*`.  
- Socket.IO uses same origins.  
- Requests with no `Origin` allowed (mobile/curl).  

Evidence: `backend/src/app.js` L22–37; `backend/src/config/env.js` L45–67.

---

## 18. Database indexes

**Status:** PASS (WARNING: OTP TTL)

Covered in §3. Script: `npm run sync-indexes` in backend.

| Severity | Issue | Fix |
|----------|-------|-----|
| WARNING | OTP `expiresAt` not TTL | Add TTL index |
| PASS | Geo indexes on reports/clusters | — |
| PASS | Refresh token TTL | — |

---

## 19. Error handling

**Status:** PASS

- `asyncHandler` + `AppError` + Zod `validateRequest`.  
- Central `errorHandler`: CORS 403, prod-safe 500 messages, no request body dumps.  
- Auth middleware returns 401 JSON for invalid tokens.

### Problems found

| Severity | Problem | Suggested fix |
|----------|---------|---------------|
| WARNING | Mixed style (some middleware `res.status` vs `next(err)`) | Standardize on `next(AppError)` |

---

## 20. Logging

**Status:** PASS (minor WARNING)

| Area | Status | Notes |
|------|--------|-------|
| Request logger | PASS | method/path/status/latency only |
| OTP | PASS | phone not logged; code opt-in |
| Error handler | PASS | no body dumps |
| syncIndexes | WARNING | may print full `MONGO_URI` |

---

## 21. Test coverage

**Status:** WARNING (good verify suite; limited unit/E2E)

### Backend critical suite (`npm test`)

Identity restore, upload idempotency, clustering, JWT boundary, rate limit, cert reissue.

### Backend verify scripts (many)

Admin audit, admin socket, dashboard live, map severity live, cluster-map live, user block audit, reports export filters, analytics, device online, F5/F6 audit, security B10, silent refresh.

### Frontend Vitest (`npm test`)

Silent refresh, protected redirect, dashboard/map/cluster socket patches, confirm-block modal, report filter params, cluster timeline.

### Gaps

- No E2E (Playwright/Cypress).  
- Limited page-level React tests.  
- Device presence integration untested end-to-end (because unwired).  
- Critical suite needs live Mongo (+ often `GOOGLE_AUTH_MOCK`).

---

## 22. Production readiness

**Status:** WARNING / Needs fixes

| Area | Status | Notes |
|------|--------|-------|
| Env fail-fast | PASS | Missing vars refuse boot |
| CORS / Helmet | PASS | — |
| Dual JWT | PASS | — |
| Mock Google guard | **FAIL** | Not blocked in production |
| Device presence | **FAIL** (feature) | Service unused |
| Docker / CI deploy | FAIL | Not present |
| Graceful shutdown | WARNING | No SIGTERM drain documented |
| Frontend bundle | WARNING | Large single chunk |
| README accuracy | WARNING | Outdated scaffold text |
| Rate limit scale-out | WARNING | Memory store only |
| Twilio conditional require | WARNING | Always required |

---

## Missing features list

1. **Wire device presence** (`touchDevicePresence`) into mobile auth/upload/heartbeat APIs.  
2. **Production hard-block** for `GOOGLE_AUTH_MOCK`.  
3. **Conditional Twilio env** when `OTP_PROVIDER=dev`.  
4. **OTP TTL index** on `expiresAt`.  
5. **Enum validation** for emergency type/severity.  
6. **Certificate revocation / current-cert marker**.  
7. **Upload per-user rate limit**.  
8. **Docker Compose** (Mongo + API + admin UI).  
9. **Updated README** (architecture, runbook, env).  
10. **Frontend code-splitting** + production env fail-fast.  
11. **httpOnly cookie refresh** (optional hardening roadmap).  
12. **E2E test suite**.  
13. **Mobile client** is out of this repo’s admin console scope (backend APIs exist).  

---

## Required API keys and environment variables

### Must have to run backend

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `MONGO_URI` | MongoDB connection | MongoDB Atlas or local Mongo |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Mobile JWT | Generate strong random secrets |
| `ADMIN_JWT_SECRET` / `ADMIN_JWT_REFRESH_SECRET` | Admin JWT (≠ mobile) | Generate strong random secrets |
| `GOOGLE_CLIENT_ID` | Google ID token audience | Google Cloud Console OAuth client |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | OTP SMS (required at boot today even for dev provider) | Twilio console |
| `ADMIN_ORIGIN` | CORS allow-list (e.g. `http://localhost:5173`) | Your admin UI origin |
| `CERT_SIGNING_PRIVATE_KEY` | Ed25519 PEM | `cd backend && npm run generate:cert-keypair` |

### Strongly recommended

| Variable | Purpose |
|----------|---------|
| `OTP_PROVIDER=dev` | Local OTP without SMS |
| `GOOGLE_AUTH_MOCK=true` | **Dev/tests only** |
| `CERT_SIGNING_PUBLIC_KEY` | Server-side verify helpers |
| `DEVICE_ONLINE_WINDOW_MS` | Online threshold (default 15 min) |

### Frontend

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | API base URL | `http://localhost:5000` |
| `VITE_SOCKET_URL` | Socket.IO base URL | `http://localhost:5000` |

---

## Scores and final verdict

| Metric | Score | Rationale |
|--------|-------|-----------|
| **Architecture** | **8 / 10** | Clear dual-boundary design, solid domain services, admin realtime, analytics aggregates |
| **Security** | **7 / 10** | Strong JWT/CORS/Helmet/audit story; mock Google + validation gaps hold it back |
| **Production readiness** | **6 / 10** | Excellent for demo/dev; needs guards, device wiring, packaging, docs |

### Final verdict: **Needs fixes**

Ready for **continued development and supervised local demos**.  
**Not ready** for production internet exposure until at least:

1. Production blocks `GOOGLE_AUTH_MOCK`.  
2. Device presence is wired or the feature is explicitly deferred.  
3. OTP/Twilio env + phone validation hardened.  
4. README / deploy story updated (and preferably Dockerized).

---

## How to run the frontend and backend

### Prerequisites

- Node.js 18+ (recommended 20+)
- MongoDB running locally **or** MongoDB Atlas URI
- Two terminals

### 1. Backend

```bash
cd backend
npm install
```

Copy env template and fill secrets:

```bash
# Windows PowerShell
copy .env.example .env
```

Edit `backend/.env` at minimum:

- `MONGO_URI`
- JWT + ADMIN JWT secrets (four distinct values)
- `GOOGLE_CLIENT_ID` (or set `GOOGLE_AUTH_MOCK=true` for local mock tokens)
- Twilio placeholders (required by current env validator even if `OTP_PROVIDER=dev`)
- `ADMIN_ORIGIN=http://localhost:5173`
- `CERT_SIGNING_PRIVATE_KEY` — generate with:

```bash
npm run generate:cert-keypair
# paste PEM into .env (use \n for newlines if single-line)
```

Seed an admin user:

```bash
npm run seed:admin -- --email admin@example.com --password "ChooseAStrongPass1!"
```

Start API (default port **5000**):

```bash
npm run dev
```

Health check: open `http://localhost:5000/health`

Optional tests:

```bash
npm test
npm run verify:security-b10
```

### 2. Frontend

```bash
cd frontend
npm install
```

Ensure `frontend/.env` (or `.env.example` copied) contains:

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Start Vite (default port **5173**):

```bash
npm run dev
```

Open: `http://localhost:5173`  
Sign in with the seeded admin email/password.

Optional frontend tests:

```bash
npm test
```

### 3. Typical local demo checklist

1. Backend `npm run dev` on `:5000`  
2. Frontend `npm run dev` on `:5173`  
3. Login → Dashboard / Map / Clusters  
4. (Optional) Use mobile-facing upload APIs with a mobile JWT to create clusters and watch live map/dashboard updates  

---

*End of audit report. No application source code was modified for this audit beyond creating this `AUDIT_REPORT.md` file.*
