# Customer and purchase deletion

Follow-up fix, 22 October 2026: localhost was using the production database while the two new migrations were still pending. Both `20261022090000_nullable_purchase_total` and `20261022100000_recoverable_deletion` have now been applied successfully with `prisma migrate deploy`. Read-only verification against that configured database passed for customer search, details with purchases/prescriptions, Trash and dashboard. No customer records were deleted or overwritten. The earlier statements below about leaving production unmigrated describe the initial implementation, before this follow-up. Application deployment and reconciliation with the newer production workflows remain separate work.

Implemented in the existing Customer Details layout: an outlined red customer action, a purchase trash icon on each purchase header, and confirmation dialogs with record details. Existing customer sections, prescription previews, prices, classifications, notes and document actions remain in place.

## Findings and compatibility

This checkout uses PostgreSQL/Prisma, not MongoDB/Mongoose. It had no customer/purchase DELETE endpoints or usable Trash page/restore endpoints. Partial schema edits contained duplicated model bodies and literal diff markers; these were repaired while retaining the existing nullable MRP work.

Read-only inspection found the configured production database ahead of this checkout: it already has `deletedAt`, `deletedBy`, `deleteReason`, inventory, ledger, note-version and audit tables absent from the local Prisma model and migration history. The implementation reuses `deletedAt` and adds deletion-group metadata. Existing tombstones are excluded from active views and are never silently restored. No production migration or record mutations were performed.

Before deployment, reconcile this checkout with the newer production application and migrations, including its existing audit, note-version, inventory and ledger workflows. Do not deploy this older checkout over those features. Older Trash items without deletion-group metadata remain visible, but restoration is rejected with an explicit instruction to use the original Trash workflow; their cascade provenance cannot safely be inferred.

## API

All paths below are under `/api/customers` and inherit the existing `requireAdmin` authentication and write-origin protections. This application has one admin account; no new staff role or authorization bypass was introduced.

| Method | Path                             | Behavior                                                                |
| ------ | -------------------------------- | ----------------------------------------------------------------------- |
| DELETE | `/:id`                           | Soft-delete customer and currently active owned purchases/prescriptions |
| DELETE | `/:id/records/:recordId`         | Soft-delete exactly that customer's selected purchase                   |
| GET    | `/trash`                         | List trashed customers and purchases belonging to active customers      |
| POST   | `/:id/restore`                   | Restore only the customer's deletion group                              |
| POST   | `/:id/records/:recordId/restore` | Restore selected purchase and its necessary prescription dependency     |

Responses follow the existing `{ success, message, data }` convention and return affected customer/purchase/prescription IDs or a deletion group. Invalid UUIDs return 400, missing or foreign records return 404, and conflicts use the existing error handler. Transactions use serializable isolation, a 10-second acquisition limit and a 15-second execution limit. Concurrent conflicts remain retryable errors rather than partial successes.

## Data rules

- Customer deletion marks only active owned children with the same fresh group and deactivates the customer. Customer notes and references remain stored. Restoring the group does not resurrect purchases or prescriptions deleted earlier.
- Purchase deletion leaves customer personal data, notes, other purchases and unrelated prescriptions unchanged.
- Prescription cascade requires a matching customer, explicit `createdForPurchaseId` provenance, and no other active referencing purchase. Historical/unknown provenance and older existing prescriptions are preserved. New customer and add-purchase flows record provenance atomically. No historical backfill guesses ownership.
- Restoring an earlier purchase can restore its shared prescription dependency if that prescription subsequently followed its creator purchase into Trash. It does not restore the other purchase.
- Catalog products are never deleted. Tracking orders/history inherit customer/purchase visibility and remain stored with unchanged statuses for restoration.
- Confirmation dialogs remain open on failure. Pending refs and shared in-flight API promises prevent repeated clicks. Purchase deletion forces a fresh backend read, cancelling older refreshes; counts, totals, prescriptions and previews derive from that response. Customer deletion navigates to the customer listing with a success notification.
- Dashboard, analytics, CSV exports, recent purchases, gender/registration reports and order queries exclude deleted data. Analytics caches are scoped to each analytics-page visit.

## Files changed for this task

- `client/src/pages/CustomerDetailPage.tsx`, `CustomersPage.tsx`, new `TrashPage.tsx`
- `client/src/services/customerApi.ts`, `client/src/app/router.tsx`, `client/src/components/layout/AppLayout.tsx`
- `client/src/components/customers/AddPurchaseDialog.tsx`: existing MUI system props moved to `sx` to resolve build errors without changing appearance
- New `server/src/services/deletionService.ts`, `server/src/controllers/deletionController.ts`
- `server/src/routes/customerRoutes.ts`, `server/src/models/schema.prisma`
- `server/src/services/customerService.ts`, `customerHistoryService.ts`, `orderService.ts`, `dashboardService.ts`, `analyticsService.ts`, `analyticsQueries.ts`
- New `server/prisma/migrations/20261022100000_recoverable_deletion/migration.sql`
- New `server/tests/deletion.test.ts`; updated API, analytics, purchase, order and customer-age test expectations for active-record filtering
- New `server/scripts/database/verifyDeletion.ts` and this report

Other pre-existing working-tree changes were retained.

## Verification

Executed successfully:

- Backend TypeScript and tools TypeScript checks
- Frontend TypeScript and production build
- Client ESLint (the repository has no backend lint script)
- Backend production build and compiled-app health test
- Prisma schema validation and client generation
- Targeted deletion, API authorization, analytics and order tests: 45/45 before adding two more passing restore/legacy regressions
- Full suite: 114 tests, 110 passed, 4 failed; all 17 deletion regressions passed
- Real PostgreSQL migration plus service integration on isolated branch `codex-customer-delete-20261022` (`br-rough-rain-b41g8dcp`): customer/purchase deletion and restoration, shared/exclusive prescription rules, older Trash preservation, search exclusion, personal notes, revenue and purchase totals, dashboard and Trash queries

The isolated branch expires on 23 October 2026 at 19:30 IST. Its migration was applied transactionally as SQL because production's newer migration history differs from this checkout. Synthetic verification fixtures remain only in that expiring branch. The guarded verification script refuses a production hostname. Production credentials/configuration were not changed.

Full-suite failures are existing inconsistencies with the working tree's optional-product/nullable-price behavior:

1. `customer.test.ts`: split-pricing fixture supplies rates without product descriptions and expects a total.
2. `customerAge.test.ts`: the same incomplete split-pricing fixture expects a total.
3. `newPurchaseForm.test.ts`: expects a blank optional price to be invalid.
4. `purchaseService.test.ts`: expects missing product information to be invalid although the current schema accepts it.

Full output is in `artifacts/deletion-tests.log` (local artifact). These pricing rules were not changed by this task. No browser-driven UI interaction test was run. Production migration/deployment and compatibility with the newer application's extra workflows remain pending the source/schema reconciliation above.
