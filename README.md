# Optical CRM
<<<<<<< HEAD
# Opitcal-CRM
=======

Single-shop CRM for customers, optical prescriptions, purchase history, frame and lens catalogs, receipts, PDFs, WhatsApp sharing, and dashboard analytics.

The frontend uses React, TypeScript, Material UI, and Vite. The API uses Express, Prisma, and PostgreSQL.

## Setup

Use Node.js 24 and npm. Install the locked dependencies from the project root:

```powershell
npm --prefix server ci
npm --prefix client ci
npm ci
Copy-Item server/.env.example server/.env
```

Set `DATABASE_URL` and `DIRECT_URL` in `server/.env` to the pooled (`-pooler`) and direct endpoints of the same Neon database. Both must include `sslmode=verify-full`. The API enforces Neon endpoints and certificate verification; it has no alternative database or file-store fallback. `DIRECT_URL` is used only for migrations and read-only lock diagnostics. `CLIENT_URL` must exactly match the browser origin, including its port; production requires HTTPS.

Set `SESSION_SECRET` to at least 32 random bytes encoded as hexadecimal. Generate it locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and keep it in the gitignored environment file or your deployment secret manager. All API instances must use the same key. The local workspace has been configured; a new deployment still needs this secret. `DB_POOL_MAX` defaults to 10 per process. Set `TRUST_PROXY_HOPS` to the number of trusted reverse proxies in front of Express (0 locally), and prevent direct access around those proxies.

```powershell
cd server
npm run db:generate
npm run db:migrate
npm run db:seed
npm run admin:create
```

The seed provisions the required shop only. It preserves an existing shop's ID and name and never inserts or overwrites customer, prescription, or purchase records. The stable `DEMO_SHOP` code is retained for compatibility with existing data. Database setup commands change the configured Neon database; they are separate from the checks below. Historical demo-data generators have been removed.

## Workspace structure

```text
client/src/
  app/                router and protected layout
  components/         reusable UI and feature dialogs
  models/             typed customer, catalog, order, auth and analytics data
  pages/              route screens
  services/           shared HTTP layer and API requests
  theme/              Material UI theme
  utils/              calendar, receipt and document helpers
server/src/
  config/             Neon, TLS, pool and session settings
  controllers/        HTTP request/response handling
  middleware/         authentication, origin checks, limits and errors
  models/             canonical Prisma schema.prisma
  routes/             endpoint declarations
  services/           business rules and Neon reads/writes
  utils/              dates, errors, logging, cookies and calculations
  validators/         request validation
server/prisma/        unchanged migration history and shop provisioning
server/scripts/
  admin/              account and session maintenance
  build/              safe cleanup of compiled server output
  database/           read-only audit and lock diagnostics
server/tests/         regression tests and API fixtures
scripts/              source packaging
docs/                 audit and architecture notes
```

The generated Prisma client stays in the ignored `server/src/generated/prisma` directory. It is generated from `server/src/models/schema.prisma`; there is no second schema or handwritten duplicate ORM model layer. Controllers use services, and all services share `config/database.ts`.

## Run locally

Run these commands in separate terminals from the project root:

```powershell
npm --prefix server run dev
npm --prefix client run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to `http://127.0.0.1:5000`. The default backend port is `5000`; its health endpoint is `/api/health`.

All environments require an Admin session. Create an Admin using `admin:create` if one does not exist. Product Catalog is available to the authenticated Admin at `/admin/catalog`.

## Sessions and performance

Neon stores hashed opaque session tokens with an absolute seven-day expiry. Cookies use HttpOnly and SameSite=Strict, with Secure enabled in production; local HTTP development uses a non-Secure cookie. Login rotates the current browser's prior session, logout deletes it, and a password reset changes the password and revokes sessions atomically.

A second signed cookie contains only an expiry and signature. It avoids session database lookups for GET/HEAD requests for at most 30 seconds and cannot extend itself. Writes and `/api/auth/me` always verify the session in Neon. A session revoked elsewhere can therefore retain read access for up to 30 seconds; writes are denied immediately. Proofs never outlive their database session and contain no customer or purchase data. No session file cache, Redis, localStorage or local JSON database is used. Login rate-limit counters are temporary process memory, not a persistent session store; use an infrastructure rate limit as well when running multiple API instances.

The protected client layout restores identity once per mount, shares simultaneous restoration requests, and handles a 401 from every API service by returning to login. A Sign out control revokes the current session. API responses and browser API requests use `no-store`. The former module-level customer-record cache has been removed; only the current screen's React state holds returned records, and navigating away releases that state.

The API shares one bounded PostgreSQL pool with finite connection/query timeouts and shuts it down on SIGINT/SIGTERM. Analytics are grouped by month/category in PostgreSQL instead of transferring every purchase to Node. This reduces data transfer and application-side work; it does not eliminate network latency or Neon's compute wake-up time.

## Order tracking

Staff create tracking orders explicitly from existing purchases at `/orders`. Each purchase can have one order; only purchases without a tracking order appear in the creation dialog. Creating an order does not create another bill. Delivered and cancelled orders remain closed, and status changes are recorded in order history.

Remove Order is available on each order card and in its details dialog, including closed orders. Confirming removal permanently deletes the tracking order and its status history, keeps the customer and saved purchase, and allows that purchase to be tracked again. The authenticated endpoint is `DELETE /api/orders/:id`; no additional database migration is needed for removal.

Search checks all matching orders before pagination. Active and Overdue filters work from both the dashboard and Orders page; overdue dates use the shop's Asia/Kolkata calendar. Reload Order in the details dialog retrieves the latest state after a conflict. Internal notes stay out of pickup messages.

The authenticated API supports `GET /api/orders?status=ACTIVE|OVERDUE|<status>&search=<text>&page=1&pageSize=20`, `GET /api/orders/eligible-purchases?customerId=<id>`, and the existing create, details, summary and update endpoints. Status updates accept an optional `expectedStatus` to reject actions from an outdated screen. Apply the existing order-tracking migration with the database migration command in Setup before using these endpoints.

## Checks

```powershell
npm run check
```

This runs the pinned formatter check, client lint, server/tool type checks, all regression tests, both builds, the compiled-server smoke test and Prisma validation. It never seeds, migrates or modifies the live database. Individual checks remain available:

```powershell
npm run format:check
npm run format
npm --prefix client run lint
npm --prefix client run build
npm --prefix server run build
npm --prefix server test
npm --prefix server run test:build
npm --prefix server run db:validate
npm --prefix server run db:audit
```

The server build generates Prisma before compiling. Keep `rewriteRelativeImportExtensions` enabled: generated Prisma TypeScript imports must become JavaScript imports in `dist`. Prisma discovers `server/prisma.config.ts` automatically. Unit/API tests use isolated request servers, mocked database operations and fake Neon URLs; they do not read or write CRM records. `db:audit` is a separate read-only check against the configured live Neon database: it verifies required tables and runs analytics without logging records or credentials. Schema validation and client generation do not apply migrations.

The audit findings, data-access inventory, security boundaries and verification results are in [docs/neon-session-audit.md](docs/neon-session-audit.md).

The October 2026 CRUD audit has a [complete operation inventory](docs/crud-inventory.md) and an [evidence-based health report](docs/crud-audit-report.md). Its opt-in integration/browser harness uses a separately guarded synthetic database; it is not part of the default mock-based test suite.

## Production

Build both applications, serve `client/dist` with SPA fallback to `index.html`, and proxy `/api` to the Express server on the same public origin. Set `NODE_ENV=production`, `CLIENT_URL` to the HTTPS frontend origin, `SESSION_SECRET`, both Neon connection variables, and the correct proxy-hop count on the server. Start Express from `server` using `npm start`. Production session cookies require HTTPS. After changing runtime configuration or server code, restart the API process.

Apply the existing migrations to the intended database with `npm run db:migrate`. Run `npm run db:seed` to provision the required shop if it is missing, then `npm run admin:create` if an Admin does not exist. These commands are explicit setup operations and are never part of the build or checks.

Admin maintenance commands, run from `server`, are `npm run admin:create`, `npm run admin:reset`, `npm run admin:sessions`, and `npm run admin:revoke`. Password resets revoke existing sessions.

## Clean source archive

From a Git checkout with RTK available:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-clean.ps1
```

This creates `artifacts/optical-crm-clean.zip` from current source files, including root tooling and the canonical model schema. It excludes dependencies, generated code, build output, credentials and local tool configuration. `.env.example` is included. Old review exports, historical backup trees, scratch reports and duplicate ZIPs have been removed from the workspace. `npm run package:source` runs the same packaging command from the project root.
>>>>>>> production-deployment
