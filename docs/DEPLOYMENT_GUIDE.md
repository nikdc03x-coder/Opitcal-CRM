# Optical CRM Production Deployment Guide

This guide provides step-by-step instructions to deploy Optical CRM to production.

---

## 1. Hosting Architecture Options & Cost Breakdown

### Option A: Render (Recommended for Simplicity & Reliability)

- **Architecture:** 1 Web Service running Node.js 20+ / Express serving both the React SPA and `/api/*` endpoints on a single origin.
- **Estimated Cost:**
  - Web Service (Starter): **\$7 / month** (24/7 uptime, 512 MB RAM, 0.5 CPU, auto-restart).
  - Free tier option: **\$0 / month** (sleeps after 15 min inactivity; wakes in ~30s).
  - Database (Neon PostgreSQL): **\$0 / month** on Neon Free Tier (0.5 GB storage, autoscaling compute).
- **Pros:**
  - Same origin (`https://crm.yourdomain.com`) guarantees 100% cookie reliability for `SameSite=Strict`.
  - Zero cross-origin / third-party cookie issues on Safari / iOS.
  - Native health checks at `/api/health`.

### Option B: Railway

- **Architecture:** Single service deployed from Docker or Git repository root.
- **Estimated Cost:** Usage-based, typically **\$5 / month** (includes \$5 monthly free credit).
- **Pros:** Extremely fast deployments, integrated environment management, automatic SSL.

### Option C: Vercel (Frontend) + Render/Railway (Backend)

- **Architecture:** Frontend hosted on Vercel (`vercel.json` rewrites `/api/:path*` to backend URL).
- **Estimated Cost:** Vercel Free (\$0) + Backend (\$5–\$7/mo).
- **Pros:** Worldwide CDN for static assets; proxy rewrites maintain same-origin cookie behavior.

---

## 2. Prerequisites & Preparation

1. **Git Repository:**
   Ensure the current branch `production-deployment` is pushed to GitHub or GitLab:

   ```bash
   git push -u origin production-deployment
   ```

2. **Generate Session Secret:**
   Generate a cryptographically secure 64-character hexadecimal key:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Neon PostgreSQL Credentials:**
   Retrieve your Neon connection strings:
   - Pooled connection (`DATABASE_URL`): `postgresql://...@ep-...-pooler...neon.tech/neondb?sslmode=verify-full`
   - Direct connection (`DIRECT_URL`): `postgresql://...@ep-...neon.tech/neondb?sslmode=verify-full`

---

## 3. Step-by-Step Deployment on Render

### Step 1: Create Web Service

1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** $\to$ **Web Service**.
3. Connect your GitHub/GitLab repository and select branch **`production-deployment`**.

### Step 2: Configure Service Settings

- **Name:** `optical-crm`
- **Region:** Frankfurt (EU) or Oregon (US) — choose closest to your Neon database region.
- **Runtime:** `Node`
- **Build Command:**
  ```bash
  npm run build && npm run db:migrate
  ```
- **Start Command:**
  ```bash
  npm start
  ```
- **Health Check Path:**
  ```
  /api/health
  ```

### Step 3: Configure Environment Variables

In the Render dashboard under **Environment**, add the following keys:

| Key                          | Value                               | Notes                                                  |
| :--------------------------- | :---------------------------------- | :----------------------------------------------------- |
| `NODE_ENV`                   | `production`                        | **Required**                                           |
| `CLIENT_URL`                 | `https://your-crm-app.onrender.com` | Replace with your exact Render domain or custom domain |
| `DATABASE_URL`               | `postgresql://...-pooler...`        | Pooled Neon PostgreSQL connection                      |
| `DIRECT_URL`                 | `postgresql://...`                  | Direct Neon PostgreSQL connection                      |
| `SESSION_SECRET`             | _(64-hex string from Step 2)_       | Keep confidential                                      |
| `TRUST_PROXY_HOPS`           | `1`                                 | Render terminates SSL at reverse proxy                 |
| `DB_POOL_MAX`                | `10`                                | Max pool connections                                   |
| `DB_POOL_CONNECT_TIMEOUT_MS` | `30000`                             | Cold-start tolerance                                   |
| `DB_POOL_QUERY_TIMEOUT_MS`   | `30000`                             | Query timeout                                          |

_(Optional email setup)_:

- `RESEND_API_KEY`: Your Resend API key
- `EMAIL_FROM`: `noreply@yourdomain.com`

### Step 4: Deploy & Verify

1. Click **Create Web Service**.
2. Monitor build logs:
   - `Prisma generate` generates the typed client.
   - `tsc` compiles backend into `server/dist`.
   - `vite build` bundles frontend into `client/dist`.
   - `prisma migrate deploy` checks migration synchronization.
3. Once live, open `https://your-crm-app.onrender.com`:
   - Verify that the login page loads cleanly.
   - Verify login with admin credentials.
   - Verify customer list, prescription viewing, and order creation.

---

## 4. Docker Deployment (Optional)

If deploying using containers (Railway, Fly.io, or AWS ECS), a multi-stage `Dockerfile` is provided:

```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/
RUN npm install
COPY . .
RUN npm run build

# Runner Stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/generated ./server/src/generated
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

EXPOSE 5000
CMD ["npm", "start"]
```

---

## 5. Troubleshooting & Maintenance

### Cold-Start Timeouts

If the Neon database sleeps due to inactivity, the pool configuration allows up to 30 seconds (`DB_POOL_CONNECT_TIMEOUT_MS=30000`) for the database to wake up. Any temporary dropout returns a clean, retryable HTTP 503 instead of corrupting data.

### Seed Initial Admin Account

If deploying on a brand new database without existing accounts:

```bash
npm --prefix server run db:seed
```

Or run the dedicated admin creation utility:

```bash
node server/dist/scripts/admin/createAdmin.js
```

### Rollback Procedure

If an issue occurs in production:

1. In Render/Railway dashboard, navigate to **Deployments**.
2. Click **Rollback** on the previously successful deployment.
3. The server will immediately revert to the earlier working release within 30 seconds.
