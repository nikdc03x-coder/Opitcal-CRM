# PIN-protected permanent deletion

Implemented alongside the existing soft-delete and restore flow, without changing Customer Details, analytics calculations, catalog data or existing API contracts.

## Workflow and UI

Trash customers and purchases now have a red outlined **Permanently Delete** action beside Restore, using `DeleteForeverOutlined`. The confirmation dialog identifies the customer/purchase, displays the irreversible-deletion warning and requires four masked numeric digits. Submit remains disabled until four digits are entered; correctness is checked only on the server. Pending mutations share a ref guard, prevent repeat clicks and prevent closing the dialog while processing.

Success removes the confirmed record, clears the PIN, closes the dialog, shows a notification and refreshes Trash. Failure keeps the record and dialog, clears the PIN and shows the server error. A separate refresh failure after confirmed deletion is reported accurately. Refresh, search and pagination are available without changing the existing record-card layout. The page remains inside the application's administrator-only route.

## API

- `DELETE /api/customers/:id/permanent`
- `DELETE /api/customers/:id/records/:recordId/permanent`

Both require a JSON body containing a string `pin`, exactly four digits. URL query parameters are rejected. Existing administrator-session and trusted-origin middleware runs before the limiter and controller. The middleware passes the authenticated admin ID through server response locals. Writes cannot use the read-only session proof.

Responses use `{ success, message, data }`. Malformed input returns 400, missing session 401, wrong PIN 403, missing/foreign records 404, active/retained records 409, lockout/rate limiting 429 and missing PIN setup 503. Database failures use the existing sanitized error handler.

## PIN configuration

The requested initial PIN **9090 has been configured** in the database used by localhost after applying migration `20261022120000_admin_deletion_pin`. No production permanent-delete requests were made during verification.

The new `AdminDeletionPin` table holds an admin-linked salted scrypt hash, failed-attempt counter and lock expiry. The existing password hashing utility is reused with a domain prefix. No plaintext PIN or hash is exposed to React, frontend environment variables, API responses or application logs.

To change the PIN later, run from the `server` directory:

```powershell
rtk proxy npm run admin:pin
```

Enter and confirm the new PIN at the hidden prompts. This is a trusted server-operator command, like the existing admin password management scripts; it does not require source changes. Do not pass the PIN as a command-line argument or URL parameter. Setup resets the lockout state.

Verification locks the admin account for 15 minutes after five wrong attempts. Counters persist across processes/restarts, and attempts are serialized with a database row lock. Failure counters commit before an error response is raised. An additional per-IP request limit allows 20 requests per 15 minutes. The database account lock remains effective across workers; the existing Express in-memory request limiter is process-local. Existing production HTTPS-origin requirements and secure session cookies remain in force; terminate TLS at the deployed application's proxy.

## Relationship and retention policy

Permanent deletion uses one serializable transaction with bounded acquisition/execution times. The selected customer or purchase must already have a soft-delete timestamp, belong to the configured shop/customer and still exist. Active owned purchases or prescriptions block an entire-customer purge rather than being silently removed.

- Customer purge removes owned purchases, prescriptions, notes and optional `CustomerNoteVersion` history. Tracking orders and their status history are removed in dependency order, matching the application's existing order-deletion policy.
- Purchase purge preserves the customer, notes, other purchases and unrelated prescriptions. A linked prescription is eligible only when it is also soft-deleted, belongs to that customer, has explicit `createdForPurchaseId` provenance for that purchase and has no other referencing purchase, including purchases in Trash. Historical/unknown provenance is preserved.
- Foreign-key relationships are inspected before deleting, including links whose database rule would otherwise cascade or set references to NULL. References outside the explicit deletion plan block the operation. Unsupported composite relationships fail closed.
- Existing unmodeled financial/inventory relationships such as `LedgerEntry` and `PurchaseItem`, and supported audit/idempotency references such as `RecordAudit` and `MutationReceipt`, block deletion. Those records are not altered. There is no invented financial retention schedule; such records remain in Trash until their retention requirements are established and implemented in the current source.
- The error identifies financial ledger, inventory, audit history, or saved operation receipt references when recognized. A valid PIN does not override these protections. `scripts/database/diagnoseTrashReferences.ts` inspects schema metadata and aggregate reference counts inside a read-only transaction, without printing customer details or credentials.
- Global frame/lens catalogs, products, stock, unrelated customers and records are never deleted. Unsafe relationships or database failures abort the transaction.
- Successful purges cannot be restored. Since only already-trashed data is purged, active analytics remain unchanged.

## Files modified

- `client/src/pages/TrashPage.tsx`
- `client/src/services/customerApi.ts`
- `server/src/middleware/auth.ts`
- `server/src/routes/customerRoutes.ts`
- `server/src/models/schema.prisma`
- `server/package.json`
- New `server/src/controllers/permanentDeletionController.ts`
- New `server/src/services/permanentDeletionService.ts`
- New `server/src/services/deletionPinService.ts`
- New `server/src/middleware/deletionPinLimiter.ts`
- New `server/scripts/admin/setDeletionPin.ts`
- New `server/prisma/migrations/20261022120000_admin_deletion_pin/migration.sql`
- New `server/tests/permanentDeletion.test.ts`
- New `server/scripts/database/verifyPermanentDeletion.ts`

## Verification

- 44/44 focused tests passed: PIN configuration/rotation, malformed or absent PINs, persistent failed attempts, lockout/expiry, rate limiting, admin/origin protection, customer/purchase ownership, active-record rejection, cascades, historical/shared prescriptions, transaction failures, request-body PIN handling, existing restore and analytics regressions.
- Full suite: 128 tests, 124 passed, 4 existing pricing/optional-field failures. Full output: `artifacts/permanent-deletion-tests.log`.
- Real PostgreSQL and authenticated HTTP verification passed using freshly created synthetic fixtures on the hard-coded temporary branch `codex-customer-delete-20261022`. This covered customer/purchase purges, order/note cleanup, shared prescriptions, audit-retention rejection, PIN failures/lockout, Trash exclusion, inability to restore purged records and continued restore support for remaining records. The guard refuses production as the test target. The branch expires on 23 October 2026 at 19:30 IST.
- Backend TypeScript, production build, compiled-app health test, Prisma generation and schema validation passed.
- Focused client ESLint passed. Client TypeScript passed with unused-variable checking disabled to isolate unrelated existing errors. Vite production bundle passed.
- Standard full client lint/build remain blocked by three existing unused declarations in `CustomerDetailPage.tsx`: `ShoppingBagOutlined`, `latestRecord`, `isRxRecent`. That page was not edited.
- No browser-driven interaction/screenshot test was performed.

The additive credential migration and initial PIN setup were applied to the configured production database, then checked without returning the hash. Destructive integration tests ran only on synthetic records in the isolated branch.
