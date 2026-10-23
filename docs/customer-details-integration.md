# Customer details and new purchase integration

Verified on 22 October 2026.

## Scope and architecture inspected

The application keeps its React/TypeScript/Material UI frontend, React Router navigation, shared cookie-authenticated API client, Express controllers/services, Prisma ORM and configured Neon PostgreSQL database.

Inspected:

- `client/src/app/router.tsx`; customer listing, creation, details and editing pages; customer and catalog model/API files; shared HTTP/session behavior.
- `client/src/utils/customerDocuments.ts`, `dates.ts`, and recorded-age utilities; receipt selection, printing, PDF generation and WhatsApp handlers in the details page.
- Customer/history routes, controllers, services and validators; catalog resolution, pricing, prescription mapping, authentication and error handling.
- `server/src/models/schema.prisma`: Customer has many CustomerRecords and Prescriptions; a purchase has an optional prescription ID, its own date/pricing, and historical product descriptions. Staff notes belong to Customer.
- Dashboard/analytics services and page-scoped report cache: reports read purchase records from PostgreSQL and are requested afresh on navigation into analytics.
- Workspace scripts, Vite proxy, Prisma configuration, existing tests and read-only database audit.

## Issues found and changes made

| Issue                                                                           | Implemented change                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New Purchase dialog and open-state code existed but were unused                 | Mounted the dialog on Customer Details and added a New Purchase button.                                                                                                                           |
| Customer list had no purchase action                                            | Added an explicit New Purchase link per customer, carrying the UUID and existing search into `/customers/:id?purchase=new`.                                                                       |
| Frontend build and lint failed                                                  | Fixed unsupported Typography props, unused dialog state, synchronous effect state updates and render-time `Date.now()`. No checks were disabled.                                                  |
| Purchase default used UTC calendar date                                         | Reused `todayInIndia`, including tests at midnight in India.                                                                                                                                      |
| Catalog failures silently appeared as empty catalogs                            | Show a warning, retain manual product entry, and ignore responses after the form unmounts.                                                                                                        |
| Catalog resets could disconnect a selected product                              | Handle genuine typing/clearing separately from Autocomplete selection resets.                                                                                                                     |
| Form allowed inconsistent amounts and had no immediate submission lock          | Validate dates, description length, amount precision/range, positive totals and product/rate consistency; use a synchronous ref to guard repeated submits.                                        |
| Invalid prescription ownership became a generic HTTP 500                        | Return an actionable HTTP 400 while checking both prescription ID and customer ID.                                                                                                                |
| Purchase form only linked existing prescriptions                                | Added optional new prescription entry, using existing optical limits and mapping. New prescription and purchase are created together in one Prisma transaction.                                   |
| Purchase summaries and history needed immediate updates                         | Insert the returned purchase into current customer state, show success, select the purchases tab, and reload the database history. A reload failure remains visible separately from save success. |
| Details and editing could choose different latest purchases                     | Share deterministic purchase-date/creation-time/ID ordering. Unknown purchase dates come last. Backdated purchases stay in historical position.                                                   |
| Edit purchase accepted impossible calendar dates locally                        | Check the date round-trip before sending it to the server.                                                                                                                                        |
| Comparison could retain missing selections or imply chronological direction     | Resolve selections against current records, disable choosing the same prescription twice, and label differences explicitly as A minus B regardless of dates.                                      |
| Decimal comparisons could expose floating-point artifacts                       | Shared numeric comparison rounds to two decimals and handles missing/invalid values and zero safely.                                                                                              |
| Recorded measurements were used to infer lens design                            | Labels now describe distance/near measurements recorded, without claiming a bifocal/progressive lens was prescribed.                                                                              |
| Recording timestamps appeared as examination dates                              | Label recording dates explicitly and explain that there is no separate examination-date field.                                                                                                    |
| Shared document functions could receive an unrelated prescription               | Receipt HTML and WhatsApp receipt text include only a prescription whose ID matches the purchase and appears in the customer's prescriptions. Staff notes remain excluded.                        |
| Database foreign keys alone do not enforce same-customer prescription ownership | Extended the existing read-only audit with an aggregate cross-customer link check.                                                                                                                |

Changed implementation files:

- `client/src/pages/CustomersPage.tsx`, `CustomerDetailPage.tsx`, `EditCustomerPage.tsx`
- `client/src/services/customerApi.ts`
- `client/src/utils/customerHistory.ts` (new), `customerDocuments.ts`
- `server/src/controllers/historyController.ts`, `services/customerHistoryService.ts`, `validators/historyValidator.ts`
- `server/scripts/database/auditDatabase.ts`
- `server/tests/customerHistoryClient.test.ts` (new), `purchaseService.test.ts` (new), `api.test.ts`

Existing work in the workspace was retained, including the pre-existing purchase route, updated details UI, analytics edits and package-file edits. `BusinessAnalyticsPage.tsx` and `customerRoutes.ts` received formatter-only changes during this task. No dependencies, schema changes, migrations, seeds, resets or live customer/purchase/prescription writes were introduced or executed by this task.

## Connected workflow and relationships

1. Search Customers and choose New Purchase on the intended row, or open Customer Details and choose New Purchase there.
2. The details route loads the real customer by UUID before rendering the form. The dialog displays their name and their saved prescriptions. Search remains in the URL for back/edit navigation.
3. Enter frame-only, lens-only or frame-and-lens details; choose split rates or total MRP; choose an existing prescription, a new prescription, or no prescription.
4. `addPurchase` sends `POST /api/customers/:id/records`. It never calls customer creation.
5. The server validates the body and UUID, locates the active customer in the configured shop, validates catalog selections, checks prescription ownership and calculates final pricing. An existing prescription and new prescription cannot both be supplied.
6. The transaction creates a CustomerRecord with the selected customer's ID. Existing prescriptions retain their original IDs and are not copied or edited. If new measurements were entered, their prescription is created for that same customer and its returned ID is attached to the purchase within the same transaction. No prescription means a null link, with no fallback to the latest prescription.
7. The client immediately updates purchase count/value/history from the saved record, then fetches current customer history and prescriptions. Latest and previous purchase styling follows purchase chronology. Analytics continues reading the same purchase table on the next report visit.
8. Purchase receipt previews find the prescription by that purchase's `prescriptionId`; comparison selections and the customer's latest prescription do not override that relationship.

## Verification results

`npm run check` completed successfully:

- Repository Prettier check: passed.
- Frontend ESLint: passed.
- Backend and tooling TypeScript checks: passed.
- Automated tests: **88 passed, 0 failed**, including **14 new tests** for purchase validation, HTTP responses, customer/prescription ownership, atomic operation placement, API requests, sorting, classification, dates, comparison values and document privacy.
- Backend build/Prisma client generation: passed.
- Frontend TypeScript and Vite production build: passed.
- Compiled-server smoke test: **1 passed**.
- Prisma schema validation: passed.

The first sandboxed test attempts failed before loading tests because Windows profile lookup in `tsx` returned `uv_os_get_passwd ENOMEM`. The normal suite passed outside that sandbox. No application workaround or test bypass was added.

Read-only audit of the configured live database passed: required tables present, recorded-age columns present, **0 cross-customer prescription links**, and dashboard analytics queries succeeded across **23 reporting years**. It printed aggregate results only.

Local HTTP smoke checks passed: frontend `/` and `/customers` returned 200, Vite served the updated Customer Details module, backend `/api/health` returned 200, and an unauthenticated purchase request through the frontend proxy returned 401. Port 5173 already had the frontend running; a temporary second Vite process selected 5174 during the check. Use the configured 5173 origin for normal login and API access.

## Remaining manual verification and limitations

The browser tool reported no available browser. Therefore this task did **not** execute authenticated browser saves or edits, visually inspect desktop/tablet/mobile layouts, inspect the browser console, invoke a print dialog, generate/download an actual browser PDF, or send a WhatsApp message. Automated HTTP/service tests use mocked Prisma operations; the live database was inspected read-only. These are verification limits, not claims that those interactions passed.

In a development environment with an authenticated browser:

1. Search for a customer, start New Purchase from the list, and confirm the selected name, date and preserved search. Repeat from Customer Details.
2. Save frame-only, lens-only and combined purchases in both pricing modes, including paise; confirm count, lifetime value, ordering and latest styling. Try a backdated purchase and a blank/unknown date.
3. Link an older prescription and inspect that purchase's prescription and receipt. Save another purchase with a new partial prescription; verify it appears once in both history sections. Save an unlinked purchase and ensure it stays unlinked.
4. Attempt rapid repeated submits; test invalid dates, amounts, powers and axis values. Simulate catalog/network errors and confirm feedback and retry behavior. A network interruption after the server committed a save remains ambiguous; refresh history before deliberately retrying the save. The API has no persistent idempotency-key mechanism.
5. Edit customer details, a selected historical purchase and a selected prescription. Return to details and check updated data and preserved search.
6. Compare different prescriptions in both date orders; inspect right/left distance/near values, zero/missing measurements and A-minus-B differences. Verify history is unchanged.
7. Preview receipts with/without the linked prescription; print, download/share PDF and open WhatsApp. Confirm staff notes are absent. Sending is a staff action; the application does not automatically send the message.
8. Visit dashboard and analytics after saving and verify the purchase is included in the appropriate date/product filters. Undated purchases are excluded from date-based reports by the existing reporting rules.
9. Inspect desktop, tablet and mobile layouts, including dialog scrolling and comparison/progression table horizontal scrolling.

The existing schema stores prescription `createdAt`, not a separate historical examination date. Recorded-date labels preserve that distinction. Comparison is numerical and does not diagnose clinical progression; axis deltas are simple numerical differences, explicitly described as such in the page.

## Run locally

From the existing configured workspace in PowerShell:

```powershell
Set-Location C:\Users\x03xN\Documents\optical-crm
rtk npm run dev
```

Open `http://localhost:5173` and sign in with the existing admin account. Keep port 5173 available, or reuse an already-running frontend there. The backend uses port 5000; `CLIENT_URL` in `server/.env` must match the frontend origin. Existing database/session settings are retained.

Alternatively, use two terminals from the project root:

```powershell
rtk npm --prefix server run dev
```

```powershell
rtk npm --prefix client run dev
```

Recheck code and inspect the configured database without changing its data:

```powershell
rtk npm run check
rtk npm --prefix server run db:audit
```
