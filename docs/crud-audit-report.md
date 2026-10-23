# Optical CRM CRUD health report

23 October 2026 · Asia/Kolkata · current working tree.

Three confirmed defects were fixed and regression-tested: split-price overflow, rejection of catalog-only MRP purchases, and missing administrator authorization for permanent deletion. The audit used actual Express routes, Prisma and Neon PostgreSQL, plus the built React application in headless Edge. Existing user changes were preserved. No application change was deployed.

## Follow-up: reported Trash deletion blocker

After this audit, the user reported the retained-reference error on an existing Trash item. A separate read-only diagnostic of the configured database found one trashed purchase with two `LedgerEntry` references, three `RecordAudit` references and three `MutationReceipt` references. These are genuine retained financial/audit records; the existing policy intentionally blocks permanent deletion. No deletion, PIN change or database write was performed. Passing synthetic deletion tests did not mean that this protected existing purchase was eligible for permanent deletion.

The service message now identifies recognized financial ledger, inventory, audit-history and operation-receipt blockers. Two additional regression tests verify that clearer messages preserve the no-deletion behavior. The follow-up suite passes 159 tests and server/tool TypeScript checks. The original audit totals below describe the earlier audit run.

This report distinguishes API/database checks, real browser checks, and mock-based tests. A successful HTTP response was never used alone as persistence evidence for a critical write. Passing entries cover the specific scenarios below, not every possible input, device or deployment.

## Environment and safety

| Item                           | Verified setup                                                                                                                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend                       | React/Vite/TypeScript/Material UI; relative `/api` requests; development proxy in `client/vite.config.ts` points to local API port 5000                                                                                                               |
| Backend                        | Express/TypeScript; runtime configuration in `server/.env`; Prisma pg adapter with certificate verification                                                                                                                                           |
| Schema/migrations              | `server/src/models/schema.prisma`; `server/prisma.config.ts`; 11 checked-in migrations                                                                                                                                                                |
| Existing configured connection | Neon endpoint identified without printing credentials; treated as production/shared and never used for test reads, writes, migrations, seeding or cleanup                                                                                             |
| Test branch                    | `codex-crud-audit-20261023`, `br-red-paper-b4hwnieh`, project `silent-pond-81985208`                                                                                                                                                                  |
| Test endpoint                  | `ep-sweet-morning-b4g3qj7f.c-6.us-east-2.aws.neon.tech`                                                                                                                                                                                               |
| Test database                  | **`crm_crud_audit_20261023`**, created empty, separate from inherited `neondb`                                                                                                                                                                        |
| Test configuration             | Ignored `server/.env.audit`; separate synthetic accounts, random passwords, random deletion PIN, fresh session signing secret per run; production environment file unchanged                                                                          |
| Safety gates                   | Explicit CLI endpoint acknowledgment; exact direct/pooled hostname and database checks; reject either configured application endpoint; verify `current_database()`; require empty initial schema and a purpose marker outside Prisma's managed schema |
| Migrations                     | All 11 repository migrations successfully deployed only to the fresh audit database; no production schema change                                                                                                                                      |
| Fixtures                       | Synthetic customers, optical measurements, products, purchases, accounts and second-shop records; outbound invitation/recovery mail replaced with an in-process test transport                                                                        |
| Cleanup                        | Transactional cleanup of test-owned shops/children/accounts; direct counts verified zero customers, purchases, prescriptions, orders and accounts after each completed run                                                                            |

Neon MCP exposes normal branching, rather than a schema-only option. The branch therefore inherited the parent's original database snapshot. The audit never connected to that inherited database: it created and used a new empty database on the separate endpoint. No real customer information entered fixtures or reports.

The branch and private test connection file are retained for reproducibility. The account rejected a custom suspend interval; this branch inherited an interval of zero. Branch/compute removal was not performed. Its lifecycle should be closed after review. The application cannot silently fall back from the audit target to production.

No Playwright/Puppeteer package was installed. The existing Edge executable and Node's WebSocket/CDP support supplied browser automation. The audit served the built client and real API together on `127.0.0.1:5180`, with a separate browser profile. Database assertions ran independently of browser/API results.

## CRUD matrix

`PASS` means the listed scenarios were executed successfully at the relevant layer. `FIXED & VERIFIED` identifies a repaired path. Independent deletes that the product does not expose are `NOT APPLICABLE`. Performance `NOT TESTED` means no representative timing was collected for that module, rather than a performance failure.

| Module                                    | Create           | Read           | Update           | Delete           | E2E            | Performance    | Status           |
| ----------------------------------------- | ---------------- | -------------- | ---------------- | ---------------- | -------------- | -------------- | ---------------- |
| Customers                                 | FIXED & VERIFIED | PASS           | PASS             | PASS             | PASS           | PASS           | FIXED & VERIFIED |
| Personal details and optional age         | PASS             | PASS           | PASS             | NOT APPLICABLE   | PASS           | PASS           | PASS             |
| Purchase records                          | FIXED & VERIFIED | PASS           | FIXED & VERIFIED | PASS             | PASS           | PASS           | FIXED & VERIFIED |
| Optical prescriptions                     | PASS             | PASS           | PASS             | PASS             | PASS           | PASS           | PASS             |
| Private staff notes                       | PASS             | PASS           | PASS             | PASS             | PASS           | NOT TESTED     | PASS             |
| Independent note-version CRUD             | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE   | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE   |
| Frame catalog                             | PASS             | PASS           | PASS             | PASS             | PASS           | PASS           | PASS             |
| Lens catalog                              | PASS             | PASS           | PASS             | PASS             | PASS           | PASS           | PASS             |
| Stock quantities / supplier imports       | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE   | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE   |
| Orders / delivery / status history        | PASS             | PASS           | PASS             | PASS             | PASS           | PASS           | PASS             |
| Accounts / permissions                    | PASS             | PASS           | PASS             | NOT APPLICABLE   | PASS           | NOT TESTED     | PASS             |
| Authentication / sessions                 | PASS             | PASS           | PASS             | PASS             | PASS           | NOT TESTED     | PASS             |
| Password recovery / reset lifecycle       | PASS             | PASS           | PASS             | PASS             | NOT TESTED     | NOT TESTED     | PASS             |
| Trash / soft delete                       | NOT APPLICABLE   | PASS           | NOT APPLICABLE   | PASS             | PASS           | NOT TESTED     | PASS             |
| Customer / individual purchase restore    | NOT APPLICABLE   | PASS           | PASS             | NOT APPLICABLE   | PASS           | NOT TESTED     | PASS             |
| PIN-protected permanent deletion          | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE   | FIXED & VERIFIED | PASS           | NOT TESTED     | FIXED & VERIFIED |
| Dashboard / analytics / CSV               | NOT APPLICABLE   | PASS           | NOT APPLICABLE   | NOT APPLICABLE   | PASS           | PASS           | PASS             |
| Shop provisioning UI / multishop accounts | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE   | NOT APPLICABLE   | NOT APPLICABLE | NOT APPLICABLE | NOT APPLICABLE   |

Prescription deletion is tested through its supported customer/purchase ownership lifecycle; there is no standalone prescription DELETE. Accounts support deactivation, not account deletion. Password recovery has real API/database verification with test mail delivery and separate mock-backed UI coverage; real inbox delivery and an entirely live browser reset-link flow remain unverified. Analytics E2E covers overview persistence; every report/filter/export combination was not clicked through a real database-backed browser.

The [operation inventory](crud-inventory.md) maps every supported action to its frontend control, endpoint, controller, service, validator, Prisma operation/model, permission, response and existing test coverage.

## Confirmed fixes

| Defect and reproduction                                                                                                                             | Root cause / smallest fix                                                                                                                                                              | Regression and live verification                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two individually valid split amounts summed beyond `Decimal(12,2)`. Creating a customer returned 500 / Prisma `P2020`; the transaction rolled back. | Shared `recordSchema` checked each amount but not their sum. Validate the sum in integer paise, maximum 999999999999 paise, across every consumer.                                     | `all purchase write validators reject a split total outside Decimal(12,2)` fails before the fix and passes afterward, including the exact valid boundary. Real POST customer and PATCH purchase now return 400, without creating overflow records. |
| POST new purchase with `MRP_ONLY`, a valid catalog ID and total, but no redundant free-text description, returned 400.                              | New-purchase refinement considered descriptions only. Recognize frame/lens catalog IDs as product selections; keep active/same-shop validation in the existing transaction resolver.   | `new MRP purchases accept a catalog-only frame, lens or combined selection`; real selected catalog record persisted and independently reloaded. Missing all descriptions/IDs is still rejected.                                                    |
| A USER account with a retained administrator PIN could permanently delete a trashed customer; the live test returned 200.                           | Permanent-delete controller checked authenticated ID and PIN but not role. Carry database-validated role from write authentication and require ADMIN before PIN verification/deletion. | `a demoted account cannot permanently delete with its retained administrator PIN`; real USER with configured test PIN now receives 403, and the trashed customer remains present. Daily staff CRM permissions are preserved.                       |

The existing permanent-deletion controller test now declares the ADMIN role in its synthetic authentication fixture. Its PIN/body/lockout expectations were preserved; no failing assertion was disabled or relaxed.

## Critical-operation evidence

Exact executable test names are recorded in the JSON evidence and the harness. Each entry below identifies the expected and observed result and separates database assertions from UI refresh assertions.

| Test / operation                                                                        | API                                                  | Expected → observed                                                        | Database proof                                                                                                         | Browser refresh proof                                                                                                          |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Customer creation: all four product/pricing types; required-only; optional fields blank | POST `/customers`                                    | 201 with exact totals → PASS                                               | Customer, purchase, optional prescription read directly; zero SPH preserved; prescription provenance/ownership checked | Frame-only wizard, persisted detail reload, single record after duplicate Save clicks                                          |
| Invalid input and overflow                                                              | POST `/customers`; PATCH purchase                    | 400 before writes → FIXED & VERIFIED                                       | Customer count unchanged; overflow customer absent                                                                     | Standard form validation covered by existing client tests; every invalid payload was not repeated in the live UI               |
| `personal PATCH preserves omitted fields and clears explicit optional fields`           | PATCH `/customers/:id`                               | Change only requested fields → PASS                                        | Phone/notes survive name-only update; explicit null clears phone/age/reference and age timestamp                       | Name/phone/age/notes saved through UI; edit page reloaded and field values compared                                            |
| `new purchases: all product types, new/existing/no prescription, independent history`   | POST `/customers/:id/records`                        | 201 with correct owner/link → PASS                                         | Exact purchase and prescription IDs directly queried                                                                   | Lens-only, combined SPLIT, combined MRP, zero/partial prescription and existing prescription linking through UI; detail reload |
| `all purchase types edit independent historical rows with exact totals`                 | PATCH `/customers/:id/records/:recordId`             | Only selected row changes → PASS                                           | Frame-only, lens-only, combined and MRP values/date checked; unrelated rows compared before/after                      | Historical frame rate/date saved and reloaded; arbitrary record switching remains mock/helper coverage                         |
| Historical catalog behavior                                                             | PATCH catalog and purchase; DELETE catalog           | Preserve snapshot/inactive links; manual text clears link → PASS           | Original descriptions/totals preserved; expected IDs/nulls checked                                                     | Frame/lens catalog create/edit/delete and reload; historical inactive-link edge tested via real API                            |
| Selected prescription update                                                            | PATCH `/customers/:id/prescriptions/:prescriptionId` | Preserve omitted fields, accept zero/null, reject invalid → PASS           | Selected prescription values and unchanged unrelated history compared                                                  | Partial prescription created; selected AXIS edited, saved and reloaded                                                         |
| Tampered shop/customer/product/prescription IDs                                         | customer/catalog/order routes                        | 400/404 and no unrelated write → PASS                                      | Second-shop customer unchanged; foreign prescription/product rejected                                                  | Not exercised by manipulating browser requests; actual authenticated HTTP requests used                                        |
| Orders / delivery / transitions / cancellation / deletion                               | `/orders`, `/:id`, `/:id/status`                     | Correct unique purchase/order, status history and retained purchase → PASS | Order/history rows and delivery/cancellation timestamps queried; duplicate order rejected                              | Create, edit delivery notes, transition to Processing, reload and remove through UI                                            |
| Concurrent status change                                                                | PATCH `/orders/:id/status`                           | One winner, one 409 → PASS                                                 | Exactly one additional status-history entry                                                                            | Not repeated in two browser windows                                                                                            |
| Customer/purchase soft delete and restore                                               | DELETE customer/purchase; POST restore               | Active search exclusion; correct restore group → PASS                      | Parent/child flags, shared Rx, older trash and unrelated customer checked                                              | Actual delete/restore controls and detail reload checked in supplemental UI suite                                              |
| Permanent customer/purchase deletion                                                    | DELETE `.../permanent`                               | ADMIN + correct PIN + trash required → FIXED & VERIFIED                    | Target rows absent, unrelated rows present; exclusive Rx removed and shared Rx retained                                | Customer PIN dialog through actual UI; page reload confirms absence; individual permanent deletion checked via real API        |
| PIN validation/lockout/reference retention                                              | DELETE `.../permanent`                               | Bad/missing PIN rejected; fifth failure locks; financial FK blocks → PASS  | Persisted failure counter/lock timestamp; retained customer still present                                              | Correct PIN dialog exercised; lockout and financial blockers tested via API; request limiter covered by HTTP regression test   |
| Transaction failures                                                                    | POST customer; DELETE permanent                      | No partial commit → PASS                                                   | PostgreSQL triggers injected real failures after dependent changes; complete parent/purchase/Rx set remained           | Real error propagation via HTTP; offline browser save separately leaves data unchanged                                         |
| Concurrent delete/restore                                                               | DELETE + POST restore                                | Consistent final parent/children or conflict → PASS                        | Matching parent/child deletion states and group IDs                                                                    | API concurrency, not two browser windows                                                                                       |
| Accounts / invitation / deactivate                                                      | `/settings/me`, `/settings/users`                    | Safe fields persist, USER denied management, last admin protected → PASS   | Account/role/activity/session rows checked                                                                             | Live profile edit/reload, account creation and deactivation/reload; outgoing mail stubbed                                      |
| Password change/reset and token reuse                                                   | `/settings/me/password`, `/auth/*password*`          | Current password checked; single-use reset; sessions revoked → PASS        | Hash-backed login, consumed token absence, all affected sessions absent                                                | Separate existing mock-backed Settings/recovery browser tests; no live external email                                          |
| Analytics / CSV / dashboard                                                             | GET `/analytics/*`, `/dashboard`                     | Counts and exact monetary sums match independent SQL → PASS                | Overall/month/year values, pagination, CSV privacy and active-customer counts checked                                  | Live overview refresh after write; selected chart/report layouts covered separately with fixtures                              |
| Failure/recovery                                                                        | PATCH customer                                       | Offline/expired save cannot falsely succeed → PASS                         | Unchanged record after offline/expired attempt; successful explicit retry persisted                                    | Real network-offline mode, visible error, retry; expired session returns to Login                                              |

## Validation totals and artifacts

The complete `npm run check` chain passed, including formatting, lint, TypeScript, tests, both builds, the compiled-server smoke test and Prisma validation.

Final verification consists of 157 Node regression tests, one compiled-server smoke test, 32 API/database check groups, five focused history/concurrency/database check groups, and 17 distinct real-browser check groups. These are **212 named tests/check groups**, all passing in their final applicable runs. A group may contain many payloads/assertions; those are not inflated into separate test counts. Repeated login/runtime groups in supplemental runs are counted once.

Additional executed checks: server/tool TypeScript, client ESLint, both production builds, Prisma schema validation, repository formatting, four existing Settings/recovery browser smoke groups, and **305 responsive states**. The Settings/responsive suites use synthetic API responses and are not counted as database E2E proof.

| Command or suite                        | Final result                                                      |
| --------------------------------------- | ----------------------------------------------------------------- |
| `npm test`                              | PASS: 157/157, no skipped/cancelled tests                         |
| `npm run build`                         | PASS: API Prisma generation/TypeScript and client TypeScript/Vite |
| `npm run typecheck`                     | PASS: server and maintenance tools                                |
| `npm run lint`                          | PASS                                                              |
| `npm run format:check`                  | PASS                                                              |
| `npm --prefix server run test:build`    | PASS: 1/1                                                         |
| `npm --prefix server run db:validate`   | PASS; schema only, no migration                                   |
| Guarded API/database integration        | PASS: 32 groups                                                   |
| Guarded focused database edge cases     | PASS: 5 groups                                                    |
| Real browser + real API + test database | PASS: 17 distinct groups                                          |
| `node scripts/check-settings.mjs`       | PASS: four smoke groups, synthetic API                            |
| `node scripts/check-responsive.mjs`     | PASS: 305 states, no overflow/runtime exceptions                  |

Local evidence is under ignored `artifacts/crud-audit/`: `final-evidence.json` merges the final results, `integration-results.json` retains the 32 passing API/database groups and the superseded first browser attempt, `edge-results.json` records five passing database edge groups, `browser-results.json` records 15 passing main browser groups, and `supplemental-ui-results.json` records the two additional scenarios plus repeated login/runtime checks. Request timing/query-count/payload samples, redacted browser method/URL/status events, migration output, query plans and screenshots are also retained there.

Initial failures were retained, not concealed: the three new regressions failed before their fixes; the first isolated live pass reproduced those three defects. Later browser failures came from harness URL escaping, asynchronous loading, an order creation flow that intentionally opens its details dialog, and an incorrect error-element selector. Those test helpers were corrected without changing application behavior, and the relevant browser flows reran successfully.

## Performance and integrity

Measurements used the isolated 0.25-CU US-East test branch and up to 200 additional synthetic customers. They include remote network latency and authentication. Query counts instrument the pg client without recording query text or parameters, and include transaction/control statements. Counts for overlapping requests are shared-window observations and must not be interpreted as independent per-request counts.

| Successful operation                   | Observed latency                     | Nonconcurrent query observations |
| -------------------------------------- | ------------------------------------ | -------------------------------- |
| Customer creation                      | 1.61–2.44 seconds                    | Usually 6–9                      |
| Customer search, 200 matching fixtures | 569 ms; 50 returned; 7,236-byte body | 2 including authentication       |
| Customer detail                        | 538–570 ms in the final API run      | 3                                |
| Add purchase                           | 2.68–2.96 seconds                    | 10–11                            |
| Edit historical purchase               | 1.88–1.89 seconds, serial samples    | 7                                |
| Edit prescription                      | 1.35 seconds, one successful sample  | 5                                |
| Catalog searches                       | 282–309 ms                           | 1                                |
| Order list                             | 559 ms                               | 4                                |
| Analytics overview                     | 3.18–3.25 seconds                    | 6                                |
| Analytics paged purchases              | 268–295 ms                           | 1                                |
| CSV export, small synthetic dataset    | 1.88 seconds                         | 7                                |

These samples establish functionality and reveal perceptible remote-write/report latency; they do not establish production capacity or an SLA. No aggressive load test, production `EXPLAIN ANALYZE`, architecture change or speculative caching was applied. The representative test-database query plan is saved separately. A small-fixture sequential scan alone is not evidence of a missing index.

Search is capped at 50 customers with no continuation mechanism. Catalog and Trash services return unbounded matching lists; detail loads full history. Orders and analytics purchases have pagination; CSV uses batches. These are scaling limits, not failures reproduced at the tested volume. Investigate representative historical workloads before changing their contracts.

Transactions rolled back real injected failures without partial parent/child deletion or creation. The independent ownership/orphan query returned zero. Cleanup verified zero test business/account records. Catalog FK deletion preserved historical descriptions/prices. No existing production records, migrations, hashes, accounts or PINs were changed.

## Remaining limits and deployment status

- This is a single-shop application. Object scoping rejects IDs from the synthetic second shop, but account-to-shop membership and a multi-tenant authorization model do not exist.
- Customer creation has no HTTP idempotency contract. Two deliberate simultaneous POSTs create two customers; shared phone numbers are supported. The real wizard's double Save click created one record. An ambiguous network loss after server commit was not claimed as idempotent or exhaustively tested.
- Concurrent purchase edits use last-writer-wins semantics. Observed final row values remained internally consistent; stale editors are not guaranteed a conflict warning. Order status changes do reject stale expected status.
- Existing signed read proofs allow business reads for up to 30 seconds after revocation. Writes and Settings recheck the database immediately. This documented behavior was preserved.
- Backend timeout/invalid-response/cancellation paths have existing mock-backed coverage. A real disconnected database, arbitrary proxy timeouts, navigation during every pending mutation, multiworker limits, and every concurrent edit/deletion interleaving were not exhaustively exercised. The real database fault test injects a serialization error, not a network outage.
- Live inbox delivery remains unverified; no sender credentials are configured for the audit. HTTPS production cookie/proxy behavior was not browser-tested on a deployed site. No checked-in deployment-provider configuration was found.
- The fresh database proves the checked-in migration chain can initialize independently. It does not reconcile previously documented production migration-history drift or certify production data integrity; production was intentionally untouched.
- No critical defect remained reproducible in the executed scenarios. This is not a claim that every requested failure/performance permutation or every possible CRUD input has been proven. Unverified areas above remain release-review items.

The code is ready for review; production rollout was not performed. Review the three fixes and normal deployment checks before deployment. None of these fixes requires a new database migration.

## Files changed by this audit

Application changes: `server/src/validators/customerWriteValidator.ts`, `server/src/validators/historyValidator.ts`, `server/src/middleware/auth.ts`, `server/src/controllers/permanentDeletionController.ts`.

Regression changes: new `server/tests/crudAudit.test.ts`; role declaration in the existing `server/tests/permanentDeletion.test.ts` fixture.

Audit tooling/documentation: `scripts/audit-crud.mjs`, `scripts/audit-crud-more.mjs`, `scripts/audit-crud-edge.mjs`, `scripts/audit-crud-browser.mjs`, this report, `docs/crud-inventory.md`, README links. `server/scripts/inspectTrash.ts` received formatting only after the formatter flagged it. The repository already contained substantial unrelated changes; the full Git diff is not attributable to this audit.

To reproduce locally while the branch exists, preserve the private test environment file and run:

```powershell
rtk proxy npm run build
rtk proxy node scripts/audit-crud.mjs ep-sweet-morning-b4g3qj7f.c-6.us-east-2.aws.neon.tech
rtk proxy node scripts/audit-crud.mjs ep-sweet-morning-b4g3qj7f.c-6.us-east-2.aws.neon.tech --edge-only
```

Run these sequentially: they share a test database and local port. The endpoint is intentionally pinned; changing to a new audit branch requires reviewing the safety allowlist and supplying a separately verified private environment. Do not substitute production connection details.
