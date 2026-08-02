# WEB_PROJECT_ANALYSIS.md

**Project:** DTNEmergency (web backend + admin dashboard)  
**Path:** `D:\finalyearprojectweb`  
**Stack:** Express + MongoDB + Socket.IO (backend) · React 18 + Vite 6 + Tailwind 3 + TanStack Query + Zustand + Leaflet + Recharts (frontend)  
**Analysis date:** 2026-08-01  
**Scope:** Documentation only — no code was modified.

---

## Executive summary (integration-critical)

DTNEmergency is a **dual-trust** system:

| Boundary | Identity | Tokens |
|----------|----------|--------|
| **Mobile** | Google ID token → `User` | JWT secrets `JWT_*` with claim `typ: "mobile"` |
| **Admin** | Email/password → `AdminUser` | Separate secrets `ADMIN_JWT_*` with claim `typ: "admin"` |

The backend is purpose-built as an **emergency DTN mesh uplink API** for Android plus an operator admin SPA. Mobile auth issues Ed25519 **IdentityCertificates** signed by a server key that Android is expected to bake in-app.

**There is no `vercel.json`, `render.yaml`, or Dockerfile in the repo.** Deployment is host-side environment configuration (docs mention Vercel for SPA, Render/Railway/Fly for API).

Android app (`finalyearproject`) currently has **zero HTTP calls** to this API — integration is the gap.

---

## 1. Complete folder structure

Excludes: `.git/`, `node_modules/`, `dist/`, `build/`, `.vercel/`.

```
D:\finalyearprojectweb\
├── .gitignore
├── AUDIT_REPORT.md
├── AUTH_FLOW_AUDIT.md
├── ENV_SETUP.md
├── MIGRATION_REPORT.md
├── README.md
├── SECURITY_FIX_REPORT.md
├── UPDATED_ENV_SETUP.md
│
├── backend\
│   ├── .env                          (local secrets — gitignored)
│   ├── .env.example
│   ├── package.json
│   ├── package-lock.json
│   ├── keys\
│   │   ├── .gitignore
│   │   └── cert-signing-public.pem   # Ed25519 public; bake into Android
│   ├── scripts\
│   │   ├── generateCertSigningKeypair.js
│   │   └── seedAdmin.js              # re-exports src/scripts/seedAdmin.js
│   └── src\
│       ├── app.js
│       ├── server.js
│       ├── config\
│       │   ├── clustering.js
│       │   ├── db.js
│       │   ├── emergencyEnums.js
│       │   ├── env.js
│       │   └── socket.js
│       ├── controllers\
│       │   ├── adminAuth.controller.js
│       │   ├── adminOps.controller.js
│       │   ├── auth.controller.js
│       │   ├── cluster.controller.js
│       │   ├── emergencyUpload.controller.js
│       │   ├── health.controller.js
│       │   └── profile.controller.js
│       ├── middleware\
│       │   ├── adminAuth.js          # deprecated re-export
│       │   ├── auditLog.js
│       │   ├── auth.js               # deprecated re-export
│       │   ├── authenticate.js
│       │   ├── authenticateAdmin.js
│       │   ├── authenticateAny.js
│       │   ├── errorHandler.js
│       │   ├── notFound.js
│       │   ├── rateLimiter.js
│       │   ├── requestLogger.js
│       │   ├── requireRole.js
│       │   ├── touchPresence.js
│       │   └── validateRequest.js
│       ├── models\
│       │   ├── AdminRefreshToken.js
│       │   ├── AdminUser.js
│       │   ├── AuditLog.js
│       │   ├── Device.js
│       │   ├── EmergencyCluster.js
│       │   ├── EmergencyReport.js
│       │   ├── IdentityCertificate.js
│       │   ├── RefreshToken.js
│       │   ├── User.js
│       │   ├── index.js
│       │   └── schemas\geoPoint.js
│       ├── repositories\.gitkeep     # empty unused layer
│       ├── routes\
│       │   ├── admin.routes.js
│       │   ├── auth.routes.js
│       │   ├── broadcast.routes.js
│       │   ├── cluster.routes.js
│       │   ├── index.js
│       │   ├── profile.routes.js
│       │   └── sos.routes.js
│       ├── scripts\                  # seed + many verify:* scripts
│       ├── services\
│       ├── tests\runCriticalSuite.js
│       ├── utils\
│       └── validators\
│
└── frontend\
    ├── .env / .env.example
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── vitest.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── public\vite.svg
    └── src\
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── components\
        │   ├── ProtectedRoute.jsx
        │   ├── clusters\
        │   ├── map\
        │   ├── ui\
        │   └── users\
        ├── hooks\
        ├── layouts\AdminLayout.jsx
        ├── pages\
        ├── services\
        ├── store\
        ├── theme\
        ├── utils\env.js
        └── tests\
```

---

## 2. Frontend architecture

### 2.1 Stack and config

| Item | Detail |
|------|--------|
| React | 18.3.x |
| Bundler | Vite 6 (`frontend/vite.config.js`), dev port **5173** |
| Styling | Tailwind 3 + PostCSS; admin design tokens (`admin.*`, severity CSS vars) |
| Fonts | IBM Plex Sans / Mono (Google Fonts) |
| Routing | `react-router-dom` 7 |
| Server state | TanStack Query (`staleTime` typically 10–60s) |
| Client auth state | Zustand **in-memory only** (no localStorage) |
| HTTP | Axios client with silent admin refresh on 401 |
| Realtime | `socket.io-client` → namespace `/admin` |
| Maps | Leaflet / react-leaflet + OSM tiles |
| Charts | Recharts |
| Tests | Vitest + Testing Library |

### 2.2 Environment variables (`frontend/.env.example`)

```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

Resolved via `frontend/src/utils/env.js`.

### 2.3 Routing (`App.jsx`)

| Path | Page | Auth |
|------|------|------|
| `/login` | `LoginPage` | public |
| `/` | Navigate → `/dashboard` | protected |
| `/dashboard` | `DashboardPage` | admin JWT |
| `/map` | `MapPage` | admin JWT |
| `/clusters` | `ClustersPage` | admin JWT |
| `/clusters/:clusterId` | `ClusterDetailPage` | admin JWT |
| `/users` | `UsersPage` | admin JWT |
| `/reports` | `ReportsPage` | admin JWT |
| `/analytics` | `AnalyticsPage` | admin JWT |
| `/devices` | `DevicesPage` | admin JWT |
| `/audit-logs` | `AuditLogsPage` | admin JWT |
| `*` | Navigate → `/dashboard` | — |

`ProtectedRoute` checks `useAuthStore.accessToken`. **Full page reload clears session** (must re-login).

### 2.4 State management

#### Zustand `authStore`

| Field / action | Meaning |
|----------------|---------|
| `accessToken` | Admin access JWT or null |
| `refreshToken` | Admin refresh JWT or null |
| `admin` | `{ id, email, role, createdAt }` or null |
| `setSession(...)` | Set all three after login |
| `setTokens(...)` | Update tokens after refresh |
| `clearSession()` / `logout()` | Wipe memory |

Selector: `selectIsAuthenticated` → `Boolean(accessToken)`.

#### TanStack Query

- Shared `queryClient` in `store/queryClient.js`
- Domain hooks: `useDashboardSummary`, `useClusters`, `useClusterReports`, `useUsers`, `useReports`, `useAnalytics`, `useDevices`, `useAuditLogs`, mutations for block/verify/merge
- Socket patchers update caches for dashboard + clusters without refetch

### 2.5 Pages (one-line each)

| File | Purpose |
|------|---------|
| `LoginPage.jsx` | Admin email/password sign-in; stores session in Zustand |
| `DashboardPage.jsx` | Live ops counters from `/admin/dashboard-summary` + socket patches |
| `MapPage.jsx` | Leaflet map of active clusters with list + detail drawer |
| `ClustersPage.jsx` | Cluster table: expand reports, verify, merge (select 2) |
| `ClusterDetailPage.jsx` | Cluster summary + chronological timeline |
| `UsersPage.jsx` | Search/filter mobile users; block/unblock |
| `ReportsPage.jsx` | Filter/paginate raw reports; CSV/JSON export |
| `AnalyticsPage.jsx` | Recharts: volume, severity, cluster growth |
| `DevicesPage.jsx` | Device inventory with online/offline presence |
| `AuditLogsPage.jsx` | Read-only admin mutation audit trail |
| `PageShell.jsx` | Unused title/description placeholder shell |

### 2.6 Major components

| File | Purpose |
|------|---------|
| `ProtectedRoute.jsx` | Redirect unauthenticated users to `/login` |
| `AdminLayout.jsx` | Sidebar nav, sign-out, mounts `useAdminSocket` |
| `ClusterMap.jsx` | OSM tiles + severity-colored CircleMarkers |
| `ClusterDetailDrawer.jsx` | Side panel for selected map cluster |
| `SeverityLegend.jsx` | Map legend with letter+color severity marks |
| `ClusterReportsTable.jsx` | Nested table of reports for a cluster |
| `ClusterTimeline.jsx` | Builds first_report/report/escalation/verified timeline |
| `ConfirmBlockModal.jsx` | Requires Emergency ID type-in + ack before block |
| `AdminState.jsx` | Shared ErrorAlert, LoadingNotice, EmptyNotice, SeverityBadge |

### 2.7 Frontend services (Axios wrappers)

| File | Backend area |
|------|--------------|
| `api.js` | Axios instance + interceptors |
| `authService.js` | Admin login/refresh/logout/me |
| `dashboardService.js` | Dashboard summary |
| `clusterService.js` | Clusters + verify/merge |
| `userService.js` | Users + block/unblock |
| `reportService.js` | Reports + export |
| `analyticsService.js` | Analytics |
| `deviceService.js` | Devices |
| `auditService.js` | Audit logs |

### 2.8 Axios interceptors (`services/api.js`)

- **Request:** attach `Authorization: Bearer <accessToken>` when present
- **Response 401:** single-flight `POST /admin/auth/refresh` with refresh token; update tokens; retry once; on failure clear session and redirect to `/login`
- Skips refresh for login/refresh/logout URLs

### 2.9 Visual direction

Teal accent on cool gray canvas (`#0f766e`-family), IBM Plex, severity never color-only (letter marks L/M/H/C). Not purple-default AI styling.

---

## 3. Backend architecture

### 3.1 Boot sequence (`server.js` → `app.js`)

1. Load/validate env (`config/env.js`) — exit if required vars missing
2. Connect MongoDB with retry (`config/db.js` — 5 retries, exponential backoff)
3. `http.createServer(app)` + `initSocket(server)` (`config/socket.js`)
4. Listen on `PORT` (default **5000**)

### 3.2 Global middleware order

```
helmet
→ CORS (ADMIN_ORIGIN allow-list; no "*"; requests with no Origin allowed for mobile)
→ express.json / urlencoded
→ requestLogger
→ generalRateLimiter
→ routes
→ notFound
→ errorHandler
```

### 3.3 Mounted prefixes

| Mount | Source |
|-------|--------|
| `GET /health` | `health.controller` |
| `/auth` | `auth.routes` |
| `/profile` | `profile.routes` |
| `/admin` | `admin.routes` |
| `/broadcast` | `broadcast.routes` |
| `/sos` | `sos.routes` |
| `/clusters` | `cluster.routes` |
| `/api` | stub “DTNEmergency API” |

### 3.4 Layering

```
routes → middleware (auth/validate/audit/rate) → controllers → services → Mongoose models
```

`repositories/` is empty (unused abstraction).  
Validation: Zod via `validateRequest`.  
Errors: `AppError` + `asyncHandler` + centralized `errorHandler`.

### 3.5 Controllers

| Controller | Responsibility |
|------------|----------------|
| `auth.controller.js` | Mobile Google auth, refresh, logout |
| `profile.controller.js` | Profile + certificate |
| `emergencyUpload.controller.js` | Shared SOS/broadcast upload |
| `cluster.controller.js` | List clusters |
| `adminAuth.controller.js` | Admin login/refresh/logout/me |
| `adminOps.controller.js` | Block, verify, merge, reports, devices, users, dashboard, analytics, audit |
| `health.controller.js` | Liveness + DB status |

### 3.6 Services (business logic)

| Service | Role |
|---------|------|
| `googleAuthService.js` | Verify Google ID token / dev mock |
| `authService.js` | Create/restore User, cert, session |
| `tokenService.js` | Mobile JWT pair + rotate/revoke |
| `adminAuthService.js` | bcrypt login + admin session |
| `adminTokenService.js` | Admin JWT pair |
| `certificateService.js` | Ed25519 issue/verify DTO |
| `emergencyUploadService.js` | Idempotent upload + timestamp window |
| `clusteringService.js` | Match/create/update clusters + list |
| `adminOpsService.js` | Block/merge/verify/lists/analytics/dashboard |
| `adminRealtime.js` | Socket event names + `emitToAdmin` |
| `devicePresenceService.js` | Upsert presence + online heuristic |

### 3.7 Package dependencies (`backend/package.json`)

**Runtime:** express, mongoose, socket.io, jsonwebtoken, bcryptjs, google-auth-library, helmet, cors, dotenv, express-rate-limit, zod  
**Dev:** nodemon, socket.io-client, supertest  
**Module type:** ESM (`"type": "module"`)

---

## 4. Authentication

### 4.1 Dual trust boundary

| Boundary | Identity store | Access secret | Refresh secret | JWT `typ` |
|----------|----------------|---------------|----------------|-----------|
| Mobile | Google `sub` → `User` | `JWT_SECRET` | `JWT_REFRESH_SECRET` | `"mobile"` |
| Admin | email/password → `AdminUser` | `ADMIN_JWT_SECRET` | `ADMIN_JWT_REFRESH_SECRET` | `"admin"` |

Boot **fails** if mobile and admin secrets are not distinct. Cross-use of tokens fails verification.

### 4.2 Mobile JWT payloads

- **Access:** `{ userId, typ: "mobile" }` — TTL `JWT_EXPIRES_IN` (default `15m`)
- **Refresh:** `{ userId, jti, typ: "mobile" }` — TTL `JWT_REFRESH_EXPIRES_IN` (default `7d`)
- Refresh tokens stored hashed (`sha256`) with `jti` in `refresh_tokens`; rotated on refresh; revoked on logout; Mongo TTL on `expiresAt`

### 4.3 Admin JWT payloads

- **Access:** `{ adminId, role, typ: "admin" }`
- **Refresh:** `{ adminId, role, jti, typ: "admin" }` → `admin_refresh_tokens`
- Password hashing: bcrypt cost **12**

### 4.4 Google auth (mobile)

- Library: `google-auth-library`
- Verifies `idToken` against `GOOGLE_CLIENT_ID` (`aud`)
- Dev mock (only if `NODE_ENV !== "production"` AND `GOOGLE_AUTH_MOCK === "true"`):  
  `idToken = "mock:<googleAccountId>:<displayName>"`
- Production + mock enabled → process refuses to start

#### `authenticateWithGoogle` status outcomes

| Path | Condition | Final `status` | Also returns |
|------|-----------|----------------|--------------|
| Restore | Existing `googleAccountId` | `"restored"` | tokens + profile; optional new `identityCertificate` if publicKey changed |
| Create | New user; `publicKey` required | `"created"` | tokens + profile + `identityCertificate` |
| Race restore | Duplicate key on create | `"restored"` | same as restore |
| Error | New user without `publicKey` | 400 | — |
| Blocked | `user.isBlocked` | 403 | — |

Profile DTO fields: `emergencyId`, `displayName`, `publicKeyFingerprint`, `emergencyContact`, `isVerified`, `createdAt`, `lastSeenAt`.

### 4.5 IdentityCertificate (Ed25519)

| Item | Detail |
|------|--------|
| Private key env | `CERT_SIGNING_PRIVATE_KEY` (PEM; must be Ed25519) |
| Public key | `CERT_SIGNING_PUBLIC_KEY` optional on server; **Android must bake** `backend/keys/cert-signing-public.pem` |
| TTL | 365 days |
| Canonical bytes | `JSON.stringify({ emergencyId, publicKey, issuedAt, expiresAt })` with ISO dates, fixed property order |
| Signature | `crypto.sign(null, bytes, privateKey)` → **base64url** `serverSignature` |
| Issued when | User create; publicKey reassociation (reinstall / key change) |

### 4.6 Auth middleware

| Middleware | Behavior |
|------------|----------|
| `authenticate` | Mobile Bearer; rejects blocked users (403) |
| `authenticateAdmin` | Admin Bearer |
| `authenticateAny` | Try mobile then admin (used by `GET /clusters`) |
| `requireRole('admin','superadmin')` | Role gate |
| `touchPresence` | If `X-Device-Id` (+ optional `X-App-Version`), upsert Device presence (non-blocking) |

### 4.7 Admin SPA auth flow

1. `POST /admin/auth/login` → store tokens + admin in Zustand
2. Axios attaches Bearer access token
3. On 401 → silent refresh → retry
4. Logout → `POST /admin/auth/logout` + clear memory

---

## 5. Database analysis

### 5.1 ER summary

```
AdminUser 1──* AdminRefreshToken
AdminUser 1──* AuditLog

User 1──* RefreshToken
User 1──* Device
User 1──* EmergencyReport (as originalSenderId / uploaderId)
User.emergencyId ──* IdentityCertificate.emergencyId  (string link, not ObjectId)

EmergencyCluster 1──* EmergencyReport.clusterId
```

Blocking uses `User.isBlocked` + AuditLog — **no separate BlockedUser collection**.

### 5.2 Enums (`config/emergencyEnums.js`)

- **severity:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **emergencyType:** `sos`, `fire`, `flood`, `medical`, `collapse`, `structural collapse`, `other`

### 5.3 Collections / schemas

#### GeoPoint (`schemas/geoPoint.js`)

| Field | Spec |
|-------|------|
| `type` | `'Point'` required |
| `coordinates` | `[lng, lat]` with range validation |

#### `users` — User

| Field | Spec |
|-------|------|
| `googleAccountId` | String, unique sparse |
| `emergencyId` | required, `/^EDTN-[A-Z0-9]{5}$/`, unique |
| `displayName` | required |
| `publicKey` | required |
| `publicKeyFingerprint` | required (SHA-256 hex of key if client omits) |
| `emergencyContact` | `{ name?, phoneNumber? }` optional |
| `lastSeenAt` | Date |
| `isBlocked` | Boolean default false |
| `isVerified` | Boolean (true on Google create) |
| `createdAt` | Date |

Emergency ID alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1).

#### `admin_users` — AdminUser

`email` (unique), `passwordHash`, `role` ∈ `admin` \| `superadmin`, `createdAt`

#### `devices` — Device

`userId`→User, `deviceId` (app install id), `lastSeenAt`, `appVersion`, `status` ∈ `active`\|`inactive`\|`revoked`, unique `(userId, deviceId)`

**Online heuristic:** `status===active` AND `lastSeenAt` within `DEVICE_ONLINE_WINDOW_MS` (default 15 minutes).

#### `emergency_reports` — EmergencyReport

| Field | Spec |
|-------|------|
| `messageId` | unique idempotency key |
| `originalSenderId` | ObjectId → User (mesh originator) |
| `uploaderId` | ObjectId → User (authenticated uploader / relay) |
| `emergencyType` / `severity` | enums |
| `location` | GeoJSON Point; `2dsphere` |
| `timestamp` | Date |
| `clusterId` | ObjectId → EmergencyCluster \| null |
| `createdAt` | Date |

#### `emergency_clusters` — EmergencyCluster

| Field | Spec |
|-------|------|
| `clusterId` | `/^CLUSTER-[A-Z0-9]+$/` (generated `CLUSTER-` + 8 chars) |
| `emergencyType` / `severity` | enums |
| `location` | GeoJSON Point |
| `reportCount` | Number ≥ 0 |
| `confidenceScore` | Number [0,1] |
| `firstReportAt` / `lastReportAt` | Date |
| `status` | `unverified` \| `verified` \| `resolved` |

#### `identity_certificates`

`emergencyId`, `publicKey`, `issuedAt`, `expiresAt`, `serverSignature`  
Compound index `{ emergencyId: 1, issuedAt: -1 }`

#### `refresh_tokens` / `admin_refresh_tokens`

`userId`/`adminId`, `jti` unique, `tokenHash` unique, `expiresAt` (TTL index), `revokedAt`

#### `audit_logs`

`adminId`, `action`, `targetType`, `targetId`, `timestamp`, `metadata`

### 5.4 Clustering knobs

| Env / config | Default |
|--------------|---------|
| `CLUSTER_RADIUS_METERS` | 500 |
| `CLUSTER_TIME_WINDOW_MS` | 2 hours |

Match algorithm (`findMatchingCluster`):

1. Time window around report timestamp applied to cluster `lastReportAt`
2. `$geoNear` spherical within radius
3. Same `emergencyType`; status ∈ `unverified`/`verified`
4. Nearest match (`$limit: 1`)

On match: increment count, update lastReportAt, recompute confidence + severity, emit `cluster:updated`.  
Else: create new cluster, status `unverified`, emit `cluster:created`.

Confidence: `clamp01(0.2 + 0.5 * countFactor + 0.3 * proximityFactor)`.  
Severity: floor at max sender severity + type-weighted escalation.

### 5.5 Upload timestamp window

| Knob | Default |
|------|---------|
| `REPORT_TIMESTAMP_MAX_AGE_MS` | 48 hours |
| `REPORT_TIMESTAMP_FUTURE_SKEW_MS` | 15 minutes |

---

## 6. Socket.IO analysis

### 6.1 Namespaces

| Namespace | Auth | Behavior |
|-----------|------|----------|
| `/` (default) | — | Immediate disconnect |
| `/admin` | Admin JWT via `handshake.auth.token` OR `Authorization: Bearer` OR `query.token` | Accepts connection |

**No mobile Socket.IO namespace** (explicit comment in `socket.js`).

### 6.2 Server → admin events (`AdminSocketEvents`)

| Constant | Event string | When |
|----------|--------------|------|
| `REPORT_CREATED` | `report:created` | New emergency upload |
| `CLUSTER_CREATED` | `cluster:created` | New cluster |
| `CLUSTER_UPDATED` | `cluster:updated` | Report joined cluster |
| `CLUSTER_VERIFIED` | `cluster:verified` | Admin verify |
| `CLUSTER_MERGED` | `cluster:merged` | Admin merge |
| `DEVICE_STATUS` | `device:status` | Presence flip |
| `USER_BLOCKED` | `user:blocked` | Block |
| `USER_UNBLOCKED` | `user:unblocked` | Unblock |

`emitToAdmin(event, payload)` adds `emittedAt` ISO timestamp and emits on `/admin`.

### 6.3 Client listeners (admin SPA)

`useAdminSocket` (mounted from `AdminLayout`) patches React Query caches for:

- Dashboard summary (`dashboardSocketPatches.js`)
- Clusters / map (`clusterSocketPatches.js`)

Analytics / devices / reports lists do **not** socket-invalidate (poll/refetch only).

There are **no client→server business events** beyond connect/disconnect.

---

## 7. API documentation

Envelope (most JSON):

```json
{ "success": true, "message": "...", "data": { } }
```

Errors:

```json
{ "success": false, "error": { "message": "...", "details": {}, "code": "...", "stack": "..." } }
```

Rate limits (in-memory MemoryStore):

| Limiter | Default |
|---------|---------|
| Window | `RATE_LIMIT_WINDOW_MS` = 900000 (15m) |
| General | `RATE_LIMIT_GENERAL_MAX` = 300 / IP |
| Sensitive | `RATE_LIMIT_SENSITIVE_MAX` = 20 / IP |

Sensitive routes: Google auth, mobile refresh, admin login/refresh.

---

### 7.1 Health / stub

#### `GET /health` — no auth

Response 200/503:

```json
{
  "success": true,
  "status": "healthy",
  "server": { "uptime": 1.23, "timestamp": "ISO" },
  "database": { "status": "connected", "connected": true }
}
```

#### `GET /api` — no auth

```json
{ "success": true, "message": "DTNEmergency API" }
```

---

### 7.2 Mobile auth — `/auth`

#### `POST /auth/google` — public + sensitive RL

**Body:**

```json
{
  "idToken": "string",
  "publicKey": "string (required for new identity)",
  "publicKeyFingerprint": "string (optional)"
}
```

**Response `data`:**

```json
{
  "status": "created | restored",
  "accessToken": "...",
  "refreshToken": "...",
  "profile": {
    "emergencyId": "EDTN-XXXXX",
    "displayName": "...",
    "publicKeyFingerprint": "...",
    "emergencyContact": null,
    "isVerified": true,
    "createdAt": "...",
    "lastSeenAt": "..."
  },
  "identityCertificate": {
    "emergencyId": "...",
    "publicKey": "...",
    "issuedAt": "...",
    "expiresAt": "...",
    "serverSignature": "base64url"
  }
}
```

(`identityCertificate` on create, or on restore when public key changed.)

#### `POST /auth/refresh` — public + sensitive RL

**Body:** `{ "refreshToken": "..." }`  
**Response:** `{ "accessToken": "...", "refreshToken": "..." }` (rotated)

#### `POST /auth/logout`

**Body:** `{ "refreshToken": "..." }`  
**Response:** `{ "revoked": true }`

---

### 7.3 Profile — Bearer mobile

Headers: `Authorization: Bearer <mobile access>`; optional `X-Device-Id`, `X-App-Version`

#### `GET /profile`

→ public profile DTO (`emergencyId`, `displayName`, `phoneNumber`, `publicKeyFingerprint`, nested `emergencyContact` `{ name?, phoneNumber? }`, `isVerified`, dates)

#### `PATCH /profile`

**Body:**

```json
{
  "displayName": "Tarun",
  "phoneNumber": "+91xxxxxxxxxx",
  "emergencyContact": "+91yyyyyyyyyy"
}
```

- `displayName` required (non-blank)
- `phoneNumber` / `emergencyContact` optional; string phone or `null` to clear
- `emergencyContact` request field is a **phone string**; stored as `{ phoneNumber }` on User

**Response `data`:**

```json
{
  "emergencyId": "EDTN-XXXXX",
  "displayName": "Tarun",
  "phoneNumber": "+91xxxxxxxxxx",
  "emergencyContact": "+91yyyyyyyyyy",
  "updatedAt": "2026-08-02T10:30:00.000Z"
}
```

#### `GET /profile/certificate`

→ IdentityCertificate DTO or 404

---

### 7.4 Emergency upload — Bearer mobile + presence

**`POST /sos/upload`** and **`POST /broadcast/upload`** — **identical handler**

**Body:**

```json
{
  "messageId": "string ≤128",
  "originalSenderId": "Mongo ObjectId string",
  "uploaderId": "must equal authenticated userId",
  "emergencyType": "sos|fire|flood|medical|collapse|structural collapse|other",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "location": { "type": "Point", "coordinates": [lng, lat] },
  "timestamp": "ISO-8601 or Date"
}
```

**Service rules:**

1. ObjectIds valid
2. `uploaderId === authenticatedUserId` else 403
3. Duplicate `messageId` → idempotent 200 with `deduplicated: true` (no re-cluster)
4. Timestamp within age/future skew window
5. Create → cluster enqueue → emit sockets

**Response 201 (new) / 200 (dedup):**

```json
{
  "report": {
    "id": "...",
    "messageId": "...",
    "originalSenderId": "...",
    "uploaderId": "...",
    "emergencyType": "...",
    "severity": "...",
    "location": {},
    "timestamp": "...",
    "clusterId": "...",
    "createdAt": "..."
  },
  "created": true,
  "deduplicated": false
}
```

**Relay semantics:** authenticated device is `uploaderId`; mesh originator’s User `_id` is `originalSenderId`.

---

### 7.5 Clusters — Bearer mobile **or** admin

#### `GET /clusters`

**Query:** `emergencyType?`, `limit?` (≤200), `includeResolved?` (`true`/`false`)

**Response:**

```json
{
  "clusters": [
    {
      "id": "...",
      "clusterId": "CLUSTER-...",
      "emergencyType": "...",
      "location": {},
      "severity": "...",
      "reportCount": 0,
      "confidenceScore": 0,
      "firstReportAt": "...",
      "lastReportAt": "...",
      "status": "unverified|verified|resolved"
    }
  ]
}
```

---

### 7.6 Admin auth — `/admin/auth/*`

#### `POST /admin/auth/login` + sensitive RL

**Body:** `{ "email", "password" }`  
**Response:** `{ accessToken, refreshToken, admin: { id, email, role, createdAt } }`

#### `POST /admin/auth/refresh` + sensitive RL

**Body:** `{ "refreshToken" }` → `{ accessToken, refreshToken }`

#### `POST /admin/auth/logout`

**Body:** `{ "refreshToken" }` → `{ revoked: true }`

#### `GET /admin/me` — admin JWT + role

→ `{ id, email, role, createdAt }`

---

### 7.7 Admin ops — admin JWT + role `admin|superadmin`

#### `POST /admin/block-user` + audit `user.block`

Body: `{ "userId", "reason?" }` → `{ user, reason }`

#### `POST /admin/unblock-user` + audit `user.unblock`

Body: `{ "userId" }` → `{ user }`

#### `POST /admin/verify-cluster` + audit `cluster.verify`

Body: `{ "clusterId" }` (Mongo id or `CLUSTER-…`)  
→ `{ cluster: { id, clusterId, status, severity, reportCount, emergencyType } }`

#### `POST /admin/merge-clusters` + audit `cluster.merge`

Body: `{ "sourceClusterId", "targetClusterId" }`  
Constraint: same `emergencyType`; source deleted after reports reassigned  
→ `{ cluster: fullDto, mergedAwayClusterId }`

#### `GET /admin/reports`

Query: `page`, `limit` (≤100), `severity`, `emergencyType`, `clusterId`, `from`, `to`, bbox `minLng/minLat/maxLng/maxLat`  
→ `{ page, limit, total, totalPages, reports: ReportDto[] }`

#### `GET /admin/reports/export`

Same filters + `format=json|csv`  
- CSV: `text/csv` attachment `emergency-reports.csv` (max 5000 rows)  
- JSON: `{ reports }`

#### `GET /admin/audit-logs`

Query: `page`, `limit`, `adminId?`, `action?`  
→ `{ page, limit, total, totalPages, logs, filterOptions: { actions, admins } }`

Known audited actions: `user.block`, `user.unblock`, `cluster.verify`, `cluster.merge`

#### `GET /admin/devices`

Query: `page`, `limit`, `status`, `online` (bool), `userId`, `sort` ∈ `lastSeenAt|-lastSeenAt|appVersion|-appVersion`  
→ devices + `onlineWindowMs`, `onlineWindowMinutes`, `onlineCutoff`

#### `GET /admin/users`

Query: `page`, `limit`, `isVerified`, `isBlocked`, `q` (search emergencyId/displayName)  
→ `{ users: publicUser[], … }`

#### `GET /admin/dashboard-summary`

```json
{
  "activeEmergencies": 0,
  "clustersToday": 0,
  "verifiedUsers": 0,
  "blockedUsers": 0,
  "devicesOnline": 0,
  "generatedAt": "ISO"
}
```

#### `GET /admin/analytics?days=1..90` (default 14)

```json
{
  "days": 14,
  "since": "ISO",
  "generatedAt": "ISO",
  "reportVolumeOverTime": [{ "date": "YYYY-MM-DD", "count": 0 }],
  "severityDistribution": [{ "severity": "LOW", "count": 0 }],
  "clusterGrowthOverTime": [{ "date": "...", "created": 0, "cumulative": 0 }]
}
```

---

## 8. Admin dashboard analysis

| Area | Implementation |
|------|----------------|
| **Dashboard** | 5 live counters via summary + socket patches |
| **Map** | Leaflet CircleMarkers by severity; drawer + keyboard list; live cluster cache |
| **Clusters** | Table with expand→reports, verify, 2-select merge, detail route + timeline |
| **Users** | Filter all/verified/blocked, search, confirm-block modal (type Emergency ID), unblock |
| **Reports** | Filters (severity, time, bbox), pagination, CSV/JSON export of **same** filters |
| **Analytics** | Recharts: volume, severity bars, cluster growth (7/14/30d) |
| **Devices** | Presence + status + sort; shows online window |
| **Audit logs** | Filter by action/admin |

Live sockets patch **dashboard + clusters** only. Reports/analytics/devices need refresh/refetch.

---

## 9. Deployment architecture

### 9.1 In-repo deploy manifests

**None.** No `vercel.json`, `render.yaml`, Docker, or compose files.

Docs (`ENV_SETUP.md`, `UPDATED_ENV_SETUP.md`, `README.md`) describe:

- Frontend → Vercel (set `VITE_*` in host UI)
- Backend → Render / Railway / Fly (set secrets; set `ADMIN_ORIGIN` to SPA origin)

### 9.2 Backend required env

`MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `CERT_SIGNING_PRIVATE_KEY`, `ADMIN_ORIGIN`, `NODE_ENV`

### 9.3 Backend optional env

`PORT`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `ADMIN_JWT_EXPIRES_IN`, `ADMIN_JWT_REFRESH_EXPIRES_IN`, `CERT_SIGNING_PUBLIC_KEY`, `GOOGLE_AUTH_MOCK`, `RATE_LIMIT_*`, `DEVICE_ONLINE_WINDOW_MS`, `CLUSTER_RADIUS_METERS`, `CLUSTER_TIME_WINDOW_MS`, `REPORT_TIMESTAMP_MAX_AGE_MS`, `REPORT_TIMESTAMP_FUTURE_SKEW_MS`, `ADMIN_SEED_*`

### 9.4 Useful scripts

| Script | Purpose |
|--------|---------|
| `npm run seed:admin` | Create admin user |
| `npm run generate:cert-keypair` | Ed25519 cert signing keys → `keys/` |
| `npm run sync-indexes` | Sync Mongo indexes (post-migration cleanup) |
| `npm test` | Critical suite |
| Many `verify:*` | Auth, clustering, sockets, exports, rate limits, etc. |

### 9.5 Post-upgrade notes (from UPDATED_ENV_SETUP)

- Mobile auth is Google-only (OTP/Twilio removed)
- Run `sync-indexes` (drop obsolete phoneNumber index); optionally drop `otp_challenges`
- Checklist: env → cert keypair → `seed:admin` → `sync-indexes` → `dev`

---

## 10. File-by-file explanation

### 10.1 Backend entry / config

| File | Role |
|------|------|
| `server.js` | DB + HTTP + Socket listen |
| `app.js` | Express app + route mounts |
| `config/env.js` | Required env validation, freeze config |
| `config/db.js` | Mongoose connect/retry + status |
| `config/socket.js` | `/admin` JWT gate; reject default ns |
| `config/emergencyEnums.js` | Canonical enums + normalizers |
| `config/clustering.js` | Radius, window, severity profiles |

### 10.2 Routes / controllers / middleware / validators / utils

As named in tree:

- Routes = path + middleware chain definitions (§7)
- Controllers = thin HTTP adapters
- Middleware = auth boundaries, Zod validate, audit wrap, rate limit, presence touch
- Validators = Zod schemas for auth, admin ops, emergency upload
- Utils = `apiResponse`, `asyncHandler`, `jwt` helpers

Deprecated re-exports: `middleware/auth.js`, `middleware/adminAuth.js`.

### 10.3 Models

One collection each as in §5; `models/index.js` documents no BlockedUser collection.

### 10.4 Frontend structure

| Area | Role |
|------|------|
| `main.jsx` / `App.jsx` | Bootstrap + routes |
| `store/*` | Auth + query client |
| `services/*` | REST wrappers |
| `hooks/*` | React Query + socket patches |
| `layouts/AdminLayout.jsx` | Shell + socket |
| `pages/*` | Ops UI |
| `components/*` | Map/cluster/user/ui primitives |
| `theme/*` | Severity/chart tokens |
| `tests/*` | Vitest coverage for refresh, live updates, block modal, exports, timeline |

### 10.5 Docs already in repo

| Doc | Topic |
|-----|-------|
| `README.md` | Setup overview |
| `ENV_SETUP.md` / `UPDATED_ENV_SETUP.md` | Environment & deployment |
| `AUTH_FLOW_AUDIT.md` | Auth flow audit |
| `MIGRATION_REPORT.md` | Google-only migration |
| `SECURITY_FIX_REPORT.md` / `AUDIT_REPORT.md` | Historical audits (may mention removed Twilio) |

Prefer `UPDATED_ENV_SETUP.md` + `MIGRATION_REPORT.md` over older Twilio-era notes.

---

## 11. Missing pieces and technical debt

1. **Android does not call this API yet** — largest integration gap.
2. **No mobile Socket.IO** — Android is HTTP pull/push only by design today.
3. **`/sos/upload` ≡ `/broadcast/upload`** — no semantic difference server-side.
4. **No dedicated device registration endpoint** — Device rows appear only via `X-Device-Id` on authenticated calls.
5. **No “resolve cluster” API** — `resolved` exists in schema/status enum but no admin route sets it; UI supports verify/merge only.
6. **Admin tokens in SPA memory only** — refresh survives access expiry within tab; full reload → re-login (no httpOnly cookies).
7. **Rate limiter MemoryStore** — breaks / resets under multi-instance; no Redis.
8. **Cluster merge without multi-doc transactions** — documented as single-instance Mongo OK.
9. **Empty `repositories/`** — unused abstraction.
10. **Deprecated middleware re-exports** remain.
11. **No OpenAPI/Swagger** — this analysis is the contract source.
12. **No deploy manifests** — host env must be configured manually; CORS needs exact SPA origin(s).
13. **Historical docs** may still mention Twilio; trust updated env/migration docs.
14. **`PageShell.jsx` unused** by routes.
15. **Analytics/devices/reports** do not socket-invalidate.
16. **Identity model mismatch with Android local IDs** — backend uses Mongo `_id` + `emergencyId` + `googleAccountId`; Android mesh uses `SHA-256(googleId)` as local `userId`. Bridge must store/map Mongo ids after `POST /auth/google`.
17. **Upload body expects Mongo ObjectIds** for `originalSenderId` / `uploaderId` — Android cannot send its local SHA-256 userId without a mapping table.
18. **Broadcast content/text body is not stored** on `EmergencyReport` — only typed emergency fields + geo + severity. Narrative message text from the Android mesh is not part of the HTTP upload schema today.

---

## Android ↔ Web integration cheat sheet

### Mobile HTTP surface Android should implement

```
POST /auth/google          { idToken, publicKey, publicKeyFingerprint? }
POST /auth/refresh         { refreshToken }
POST /auth/logout          { refreshToken }
GET  /profile              Bearer mobile (+ X-Device-Id, X-App-Version)
GET  /profile/certificate  Bearer mobile
POST /sos/upload           Bearer mobile  (same body as broadcast)
POST /broadcast/upload     Bearer mobile
GET  /clusters             Bearer mobile|admin
GET  /health               probe
```

### Hard requirements for the Android client

1. Google OAuth client ID must match backend `GOOGLE_CLIENT_ID` (Android currently hardcodes a web client ID in `strings.xml`).
2. Send the **real Google ID token**, not only a local hash of the account id.
3. Send device Ed25519/X25519 **publicKey** on first create.
4. Bake and verify `backend/keys/cert-signing-public.pem`.
5. Persist mobile JWT access + refresh securely; refresh before expiry.
6. Persist backend profile mapping: Mongo `userId` / `emergencyId` ↔ local mesh identity.
7. For uploads, use stable mesh `messageId` for idempotency; set `uploaderId` to authenticated Mongo user id; set `originalSenderId` to originator’s Mongo id when known.
8. Map Android broadcast severity (`LOW|MEDIUM|HIGH|CRITICAL`) directly; map SOS/broadcast into an `emergencyType` (likely `sos` for distress).
9. Provide GeoJSON `[lng, lat]` (note longitude-first) within timestamp window.
10. Send `X-Device-Id` (stable install id) so Devices/admin presence works.

### What the admin SPA does not need from Android

Admin auth is separate. Android never uses `/admin/*`. Operators observe Android-originated reports via clustering + sockets after successful mobile uploads.

---

*End of WEB_PROJECT_ANALYSIS.md*
