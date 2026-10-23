# Neon and session audit

Audit date: 16 October 2026. Scope: active client/server source, routes, controllers, services, Prisma schema/migrations, dependencies, environment configuration, scripts, fixtures and local review exports.

## Storage inventory

| Data/path                           | Authoritative store                      | Result                                                                                                                                                           |
| ----------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customers, prescriptions, purchases | Neon through Prisma                      | No alternate database or file fallback found. Existing shop scoping retained.                                                                                    |
| Frame/lens catalogs                 | Neon through Prisma                      | Bounded list queries; same shared client as the rest of the API.                                                                                                 |
| Orders and status history           | Neon through Prisma                      | Creation, transitions and deletion retain transactions and shop scoping.                                                                                         |
| Admin password and sessions         | Neon `admins` / `AdminSession`           | Only password hashes and token hashes are persisted. Queries no longer load the password hash during session checks.                                             |
| Dashboard analytics                 | Parameterized PostgreSQL aggregate query | Monthly/category totals replace transfer of all historical purchase rows. Only five recent purchases are fetched individually.                                   |
| Session cookies                     | Browser HttpOnly cookies                 | Opaque credential and a signed proof containing only an expiry/signature; no business records.                                                                   |
| Client UI state                     | Transient React memory                   | No localStorage, sessionStorage, IndexedDB or JSON-file persistence. Simultaneous identity checks share one pending request; completed responses are not cached. |
| Login throttling                    | Transient process memory                 | Security counters only; not an application or session database. Per-instance, so infrastructure throttling remains necessary for multiple instances.             |
| Fixtures, exports, review archives  | Development files / generated outputs    | Fixtures moved under tests; obsolete review exports removed. No live customer records were deleted.                                                              |

No active MongoDB/Mongoose, SQLite, Redis, JSON database, or temporary file data cache was found. No installed MongoDB or SQLite driver was found. Prisma tooling's lockfile contains optional SQLite peer metadata; that is not an installed driver or a runtime data source and was not hand-edited out of the lockfile.

`legacyMongoId` is ordinary text reference data already stored in PostgreSQL, not a MongoDB connection or schema. These optional import identifiers and their existing migration history are preserved to avoid discarding mappings from earlier imports. There is no non-PostgreSQL application query to migrate. Historical source review copies and duplicate archives have now been removed from the workspace.

## Directory cleanup and follow-up refactor

- Removed the old `deployment-review` and `order-review` trees and ZIPs, the empty backup tree, the scratch order report and obsolete artifact outputs. Root ignore rules now replace the duplicate client/server ignore files.
- Moved the canonical schema to `server/src/models/schema.prisma`, updated its generator output and Prisma configuration, and preserved every existing migration file unchanged.
- Grouped maintenance scripts under `server/scripts/admin` and `server/scripts/database`. Updated package commands and all script imports. Moved manual JSON request fixtures under `server/tests/fixtures`; these are test input, not databases.
- Extracted frontend API data types into `client/src/models`, updated consumers to import those types directly, and kept request implementation in `services`.
- Moved auth and dashboard HTTP handlers into controllers. Centralized HTTP/Prisma error handling and moved login throttling into middleware. Express 5 propagates controller failures to the shared error handler.
- Removed the module-level customer-record Map discovered during the deeper follow-up scan. Customer records now live only in the current screen's React state after a Neon request; they are released on unmount. No cross-navigation record cache remains.
- Consolidated calendar formatting helpers and reused formatter instances. Order cards compute today's date once per render. Backend calendar helpers now live in `utils/date.ts`.
- Removed historical demo-data generators. The Prisma seed now provisions only the required shop without overwriting an existing shop name or modifying customer/purchase data. It has not been executed against the live database during cleanup.
- Added pinned root formatting tools, EditorConfig and `npm run check`. Server builds remove only the verified server `dist` directory before compiling, so moved/deleted modules leave no stale compiled duplicates. Generated clients, dependencies, secrets and migration history remain intact.

## Changes

- Enforced a pooled Neon endpoint for application traffic, a direct endpoint for migrations, the same database for both, and verified TLS. URL parameters cannot override the connection host or disable SSL.
- Centralized the driver configuration, capped the pool (default 10 connections per API process), and set 10-second connection and 15-second query timeouts. Runtime services, seeds and Admin scripts share one Prisma client; the direct lock diagnostic uses the same connection validation.
- Added graceful pool shutdown and explicit reverse-proxy configuration. API responses use `no-store` and do not advertise Express.
- Retained the existing single Admin account and password hash format. Removed the unauthenticated development bypass.
- Centralized cookie parsing/issuance/clearing, rejected ambiguous duplicate cookies, rotated the browser's old session on login, and made password reset plus session revocation atomic. Expired session cleanup runs at login, not on every request.
- Added a signed 30-second read proof. GET/HEAD requests with a valid proof skip session database queries; writes and identity restoration always consult Neon. Revocation on another instance takes effect immediately for writes and within 30 seconds for reads. Proofs expire no later than their backing session and are never renewed from a proof alone.
- Shared client cookie handling across all API modules, handled 401 consistently, deduplicated simultaneous session restoration and added Sign out. No browser token storage was introduced.
- Moved historical analytics aggregation into PostgreSQL while retaining empty months, all historical years, category totals, recent records, and the existing response shape. Reporting uses the shop's India calendar.
- Replaced raw database/auth error dumps with stable error codes so connection URLs, query values and session tokens are not logged. Database connectivity failures return a retryable 503.

## Configuration and rollout

`DATABASE_URL`, `DIRECT_URL`, `CLIENT_URL`, `NODE_ENV`, `PORT`, `SESSION_SECRET`, `DB_POOL_MAX` and `TRUST_PROXY_HOPS` are the supported settings. The audit found no dangling legacy database environment variables. The pooled and direct URLs have distinct live purposes and are both retained. Credentials stay in the gitignored environment file or deployment secrets.

The local environment was updated to verified TLS and given a random session signing key. Production must supply its own shared `SESSION_SECRET` and restart the API after deployment. Cookies remain compatible with the existing opaque session token format, so valid existing sessions can obtain a proof on their next authoritative check. No schema changes or database migrations are required by this refactor; no remote records were modified by the audit.

A diagnostic parser error exposed a connection URL in tool output before redaction was corrected. Rotate that Neon database password and replace the password in both connection URLs and any deployment secrets. Do not paste credentials into chat or commit them.

## Verification

- Read-only live Neon verification succeeded: all required application tables were present and the parameterized analytics query executed successfully against the existing database (23 reporting years in the checked dataset).
- The automated suite checks signed-cookie tampering/expiry/token binding, HttpOnly/Secure/SameSite attributes, login/logout, malformed and expired sessions, atomic password reset, authoritative write checks, query counts, shared client requests, invalid connection settings and analytics totals, along with the existing CRM/order regression tests.
- API tests demonstrate five protected reads with a valid proof perform zero session lookups; a write still performs an authoritative lookup.
- The root check command passed formatting, lint, server/tool type checks, all 45 regression tests, both builds, the compiled smoke test and Prisma validation.
- Source and dependency scans confirm a single Prisma client constructor in active application source and no runtime alternate data-store integration.
- Live browser interaction and production deployment are not verified. Live mutations/authentication were exercised with isolated database mocks; the live Neon audit was read-only. No end-to-end latency percentage is claimed from the source refactor or a single database timing.

## References

- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon secure connections](https://neon.com/docs/connect/connect-securely)
- [node-postgres SSL configuration](https://node-postgres.com/features/ssl)
- [node-postgres pool lifecycle and limits](https://node-postgres.com/apis/pool)
