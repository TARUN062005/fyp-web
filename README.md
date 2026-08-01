# DTNEmergency

MERN stack project scaffold for DTNEmergency. Structure and environment wiring only — no business logic.

## Stack

**Frontend**
- React + Vite
- Tailwind CSS
- React Router
- React Query (TanStack Query)

**Backend**
- Node.js + Express
- MongoDB Atlas
- JWT
- Socket.IO

## Project structure

```
backend/
  src/
    controllers/
    routes/
    middleware/
    models/
    services/
    repositories/
    config/
    utils/
    app.js
    server.js
frontend/
  src/
    pages/
    components/
    hooks/
    services/
    layouts/
    store/
    utils/
```

## Setup

### Backend

1. Copy environment file and fill in values:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Install and run:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Frontend

1. Copy environment file:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
2. Install and run:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Environment (backend)

Required (server exits immediately if any are missing):

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Mobile access token signing secret |
| `JWT_REFRESH_SECRET` | Mobile refresh token signing secret |
| `ADMIN_JWT_SECRET` | Admin access token signing secret (must differ) |
| `ADMIN_JWT_REFRESH_SECRET` | Admin refresh token signing secret (must differ) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (sole mobile identity provider) |
| `CERT_SIGNING_PRIVATE_KEY` | Ed25519 private key for IdentityCertificates (never commit) |
| `ADMIN_ORIGIN` | Admin frontend origin for CORS (not `*`) |
| `NODE_ENV` | Runtime environment (`development` / `production`) |

**Android follow-up:** bake the certificate-signing **public** key (`backend/keys/cert-signing-public.pem`, from `npm run generate:cert-keypair`) into the Android app so IdentityCertificates can be verified offline in the mesh.

See `UPDATED_ENV_SETUP.md` for the full post-migration env guide. Mobile auth is **Google OAuth only** — phone OTP / Twilio were removed.

Optional:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | API server port |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `GOOGLE_AUTH_MOCK` | `false` | Accept `mock:<id>:<name>` tokens (**never** in production) |

## Frontend env

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SOCKET_URL` | Socket.IO server URL |
