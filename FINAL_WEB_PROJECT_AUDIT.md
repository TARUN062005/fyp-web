# FINAL_WEB_PROJECT_AUDIT.md

**Project:** DTNEmergency (Express API + React admin SPA)  
**Path:** `D:\finalyearprojectweb`  
**Audit date:** 2026-08-01  
**Authority:** Single source of truth for web-project status after merging prior markdown reports.  

**Live verification (this pass):**
- `GET https://fyp-web-1k4k.onrender.com/health` → **200**, Mongo `connected` (uptime healthy)
- `GET https://fyp-lbrce.vercel.app` → **200** (SPA shell served)
- Admin login `POST /admin/auth/login` with seeded superadmin → **200** (earlier this session; user confirmed UI login also worked)

Kept developer docs: `README.md`, `WEB_PROJECT_ANALYSIS.md`, `ENV_SETUP.md`, `UPDATED_ENV_SETUP.md`, `ANDROID_PROJECT_ANALYSIS.md` (cross-ref). Generated audit/migration reports deleted (see §17).

---

## 1. Project overview

DTNEmergency is a **dual-trust** emergency DTN uplink:

| Boundary | Identity | Tokens |
|----------|----------|--------|
| **Mobile** | Google ID token → Mongo `User` | `JWT_*`, claim `typ: "mobile"` |
| **Admin** | Email/password → `AdminUser` | `ADMIN_JWT_*`, claim `typ: "admin"` |

Backend issues Ed25519 **IdentityCertificates** for mobile devices. Admin SPA operates clusters, reports, users, devices, analytics, and audit logs with Socket.IO live updates on **`/admin` only**.

**Current deploy:**
| Piece | Host | URL |
|-------|------|-----|
| API | Render | `https://fyp-web-1k4k.onrender.com` |
| Admin UI | Vercel | `https://fyp-lbrce.vercel.app` |
| DB | MongoDB Atlas | `dtnemergency` (via `MONGO_URI`) |

---

## 2. Current architecture

```
Admin SPA (Vite/React) ──HTTPS──► Express API ──► MongoDB Atlas
         │                            │
         └── Socket.IO /admin ────────┘
                                      ▲
Android (separate repo) ──HTTPS───────┘  (no mobile Socket.IO)
```

**Backend layers:** `routes → controllers → services → models` (`repositories/` empty).  
**Frontend:** React Query + Zustand + Leaflet + Recharts; `useAdminSocket` patches caches.

**Auth separation (verified in code):** separate secrets, `typ` claims, separate refresh collections, separate middleware (`authenticate` vs `authenticateAdmin`). Boot refuses equal mobile/admin secrets and `GOOGLE_AUTH_MOCK=true` when `NODE_ENV=production`.

---

## 3. Working features

*(Verified by live API/UI and/or concrete code + scripts.)*

| Feature | Evidence |
|---------|----------|
| Health + Mongo connectivity | Live `GET /health` **200** |
| Admin SPA served | Live Vercel **200** |
| Admin email/password login | Seeded user; `POST /admin/auth/login` **200**; user confirmed UI login |
| Admin JWT refresh/logout routes | `admin.routes.js` + token services |
| Google-only mobile auth path | `auth.routes.js` — google/refresh/logout only; `authService.js` create/restore |
| IdentityCertificate issue/sign | `certificateService.js` + `CERT_SIGNING_PRIVATE_KEY` |
| Idempotent SOS/broadcast upload | Same `uploadEmergency` handler; unique `messageId` |
| Clustering on upload | `clusteringService.js` + admin socket emits |
| Admin ops: block/unblock, verify/merge cluster | `adminOpsService.js` + routes |
| Admin lists: reports, users, devices, audit, analytics, dashboard | `admin.routes.js` |
| Clusters list for mobile/admin | `GET /clusters` + `authenticateAny` |
| Device presence touch | `touchPresence` on profile + upload routes |
| Strict severity / emergencyType enums | `emergencyEnums.js` + validators |
| Rate limits (general + sensitive) | `rateLimiter.js`; sensitive on Google/admin login/refresh |
| Admin Socket.IO realtime | `/admin` namespace + `emitToAdmin` events |
| Manual admin seed | `npm run seed:admin` (created `admin@dtnemergency.local`) |

---

## 4. Partially working features

| Feature | Limitation | Evidence |
|---------|------------|----------|
| Mobile Google auth (production) | Depends on correct `GOOGLE_CLIENT_ID` matching Android `idToken` audience | Env + Android client ID historically mismatched |
| Device presence | Requires client `X-Device-Id`; no dedicated device-registration API | `touchPresence.js`; WEB analysis §11 |
| Cluster `resolved` status | Schema/enum exists; no admin “resolve” route | Models vs `admin.routes.js` |
| `/sos/upload` vs `/broadcast/upload` | Identical handlers — no semantic difference | Both call `uploadEmergency` |
| README accuracy | Still says “scaffold only” | `README.md` L3 — **stale** |
| WEB_PROJECT_ANALYSIS Android note | Claims Android has zero HTTP — outdated vs Android integration | Analysis L24 |
| Cold start on Render | Free tier may sleep; first request slow | Host behavior |
| CORS | Works when `ADMIN_ORIGIN` includes Vercel origin | Required env; misconfig → browser failures |

---

## 5. Broken features

| Feature | Status | Evidence |
|---------|--------|----------|
| Default `GET /` | **404** | Intentional — no root handler; use `/health` |
| Placeholder `GET /api` | Stub JSON only | `routes/index.js` |
| Mobile Socket.IO | **Does not exist** | `socket.js`: “No mobile namespace yet” |
| Auto-created admin on deploy | **None** | Must run `seed:admin`; `admin@example.com` was never real |
| Phone OTP / Twilio / verify-phone | **Removed** (not broken — deleted) | AUTH_FLOW + MIGRATION reports |

---

## 6. Missing features

| Item | Severity | Notes |
|------|----------|-------|
| Mobile Socket.IO namespace | Medium | Android remains HTTP pull/push |
| OpenAPI / Swagger | Low | Contract is markdown + code |
| Docker / render.yaml / vercel.json in repo | Low | Deployed via host UI |
| Repository layer | Low | Empty `.gitkeep` |
| Resolve-cluster admin API | Low | `resolved` unused by routes |
| Dedicated device registration endpoint | Low | Presence via header only |
| Redis rate-limit store | Medium for multi-instance | In-memory MemoryStore |
| Transactional cluster merge | Medium | Documented single-instance OK |

---

## 7. Security risks

| Risk | Severity | Status / evidence |
|------|----------|-------------------|
| Dual JWT boundary | — | **Sound** — separate secrets + `typ` |
| `GOOGLE_AUTH_MOCK` in production | Critical if enabled | **Blocked at boot** when `NODE_ENV=production` |
| Admin CORS wildcard | High if `*` | **Rejected** by `parseAdminOrigins` |
| Cert private key in env | High if leaked | Must stay on Render secrets / local `.env` only — never commit |
| Mongo URI credentials in `.env` | High if committed | Gitignored; rotate if ever pushed |
| Weak default JWT secrets historically | High | Regenerated for deploy; ensure Render has strong values |
| Rate limiter MemoryStore | Medium | Per-instance; resets on multi-node |
| Logging of tokens/bodies | Low | Request logger path/status only (SECURITY_FIX) |
| No public admin registration | — | **By design** — seed only |
| OTP/SMS surface | — | **Removed** |

---

## 8. Performance risks

| Risk | Evidence |
|------|----------|
| Clustering inside upload request | Synchronous await in upload path (`emergencyUploadService` / clustering) — latency under load |
| In-memory rate limits | Not shared across instances |
| Socket broadcast to all `/admin` clients | Fine for few operators; not sharded |
| Render free-tier cold start | Observed deploy model |
| Large report exports | Admin export endpoint — watch memory on big datasets |
| 2dsphere indexes | Present on reports/clusters — good for geo queries |

---

## 9. Frontend status

| Item | Status |
|------|--------|
| Stack | React 18, Vite 6, Tailwind, TanStack Query, Zustand, Leaflet, Recharts, socket.io-client |
| Deploy | Vercel `fyp-lbrce.vercel.app` — **live 200** |
| Env | `VITE_API_URL` / `VITE_SOCKET_URL` → Render API |
| Auth UI | Admin login works (user-confirmed) |
| Live patches | `useAdminSocket` for dashboard/clusters/map (per analysis) |
| Analytics/devices/reports lists | Poll/refetch — not all socket-invalidated |
| Public registration | None |

---

## 10. Backend status

| Item | Status |
|------|--------|
| Runtime | Node + Express on Render — **live** |
| Mode | Should be `NODE_ENV=production` on host |
| Mobile routes | Google auth, profile, certificate, sos/broadcast upload, clusters |
| Admin routes | Full ops surface mounted |
| Verify scripts | Many `npm run verify:*` helpers in `package.json` |
| Critical suite | `npm test` → `runCriticalSuite.js` |
| Empty repositories | Unused |

---

## 11. Database status

**MongoDB Atlas** — connected via live health check.

| Collection / model | Role |
|--------------------|------|
| `users` | Mobile users; unique `googleAccountId`, `emergencyId` |
| `identity_certificates` (IdentityCertificate) | Server-signed device certs |
| `emergency_reports` | Uploads; unique `messageId`; 2dsphere |
| `emergency_clusters` | Clusters; unique `clusterId`; 2dsphere |
| `devices` | Presence / device rows |
| `refresh_tokens` | Mobile refresh (hashed); TTL |
| `admin_users` | Admin accounts |
| `admin_refresh_tokens` | Admin refresh; TTL |
| `audit_logs` | Admin action audit |

No `OtpChallenge` (removed). No separate BlockedUser collection — block flag on User.

---

## 12. API status

### Public
| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | none — **live OK** |
| GET | `/api` | none — stub |

### Mobile
| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/google` | sensitive RL |
| POST | `/auth/refresh` | sensitive RL |
| POST | `/auth/logout` | none |
| GET | `/profile` | mobile JWT + presence |
| GET | `/profile/certificate` | mobile JWT + presence |
| POST | `/sos/upload` | mobile JWT + presence |
| POST | `/broadcast/upload` | mobile JWT + presence (≡ SOS) |
| GET | `/clusters` | mobile **or** admin |

### Admin
| Method | Path |
|--------|------|
| POST | `/admin/auth/login`, `/refresh`, `/logout` |
| GET | `/admin/me` |
| POST | `/admin/block-user`, `/unblock-user`, `/verify-cluster`, `/merge-clusters` |
| GET | `/admin/reports`, `/reports/export`, `/audit-logs`, `/devices`, `/users`, `/dashboard-summary`, `/analytics` |

Envelope: `{ success, message?, data? }` / `{ success: false, error: { message, … } }`.

---

## 13. Socket.IO status

| Namespace | Auth | Status |
|-----------|------|--------|
| `/` (default) | — | Immediate disconnect |
| `/admin` | Admin JWT (`auth.token` / Bearer / query) | **Live** for SPA |
| `/mobile` | — | **Not implemented** |

**Events (`AdminSocketEvents`):** `report:created`, `cluster:created`, `cluster:updated`, `cluster:verified`, `cluster:merged`, `device:status`, `user:blocked`, `user:unblocked` (+ `emittedAt`).

No client→server business events beyond connect/disconnect.

---

## 14. Deployment status

| Item | Status |
|------|--------|
| Frontend | Vercel production — Ready |
| Backend | Render — live after env vars set |
| Env on Render | Must include all REQUIRED_VARS (boot fails otherwise — observed crash when missing) |
| `ADMIN_ORIGIN` | Must include `https://fyp-lbrce.vercel.app` |
| Admin bootstrap | Manual seed (not auto) |
| GitHub access warning on Render | Non-fatal clone warning; connect GitHub app optionally |
| `GET /` 404 on Render | Expected |

**Required backend env (summary):** `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `CERT_SIGNING_PRIVATE_KEY`, `ADMIN_ORIGIN`, plus recommended `NODE_ENV=production`, JWT expiries, `CERT_SIGNING_PUBLIC_KEY`, `GOOGLE_AUTH_MOCK=false`.

**Frontend env:** `VITE_API_URL`, `VITE_SOCKET_URL` → Render URL (build-time on Vercel).

---

## 15. Fake / stub implementations

| Item | Path | Risk |
|------|------|------|
| `GET /api` stub | `backend/src/routes/index.js` | Low |
| Empty repositories | `backend/src/repositories/.gitkeep` | Low |
| Deprecated middleware re-exports | `middleware/auth.js`, `adminAuth.js` | Low |
| README “scaffold only” | `README.md` | Doc debt — misleading |
| Dual upload paths | sos + broadcast same handler | Low (intentional alias) |
| `admin@example.com` in docs/examples | `.env.example` comments | Confusion — not a real account |

No TODO/FIXME stubs found in `backend/src` or `frontend/src` application logic.

---

## 16. Final verdict

# **Beta Ready** (ops demo / FYP evaluation)

### Why

- API and admin SPA are **deployed and verified**: health OK, Mongo connected, **admin login works** (API + UI).
- Dual-trust auth, Google-only mobile path, certificates, uploads, clustering, and admin ops are **implemented in code**, not scaffolds.
- Remaining gaps (no mobile Socket.IO, empty repositories, cold starts, README staleness, Android OAuth audience alignment) prevent a full **Production Ready** label for unattended public use.
- Stronger than a bare **Prototype**: real multi-host deploy with working operator login.

### Next hardening (optional)

1. Update `README.md` to remove “scaffold only”.  
2. Align Android Google client ID with `GOOGLE_CLIENT_ID`.  
3. Add `/mobile` Socket.IO only if product requires push.  
4. Document seeded admin credentials in a private ops note (not git).  
5. Consider paid Render instance to avoid sleep.

---

## 17. Deleted files list

After merging into this audit, these **generated audit/migration** markdown files were deleted from `finalyearprojectweb`:

| Filename | Original purpose | Information preserved |
|----------|------------------|------------------------|
| `AUDIT_REPORT.md` | Full codebase audit (2026-07-31) | Architecture scores, route tables, security/perf warnings, verdict |
| `AUTH_FLOW_AUDIT.md` | Google-only auth verification | verify-phone removed; create/restore; certificate without OTP |
| `MIGRATION_REPORT.md` | Google-only migration | Removed Twilio/OTP; new flow; file change list |
| `SECURITY_FIX_REPORT.md` | Security fixes write-up | Mock guard, presence wiring, enums, logging hygiene |

**Not deleted (developer docs):**
- `README.md`
- `WEB_PROJECT_ANALYSIS.md`
- `ENV_SETUP.md`
- `UPDATED_ENV_SETUP.md`
- `ANDROID_PROJECT_ANALYSIS.md`
- `FINAL_WEB_PROJECT_AUDIT.md` (this file)

---

## Appendix — Admin access (ops)

Seeded for deployment testing (not in git):

| Field | Value |
|-------|--------|
| Email | `admin@dtnemergency.local` |
| Password | `Admin@DTN2026!` |
| Role | `superadmin` |

Change after handoff if desired. `admin@example.com` was never a valid account.

---

## Appendix — How to re-verify

```text
curl https://fyp-web-1k4k.onrender.com/health
# Open https://fyp-lbrce.vercel.app → admin login
cd backend && npm test   # critical suite (local env required)
```

---

*End of FINAL_WEB_PROJECT_AUDIT.md*
