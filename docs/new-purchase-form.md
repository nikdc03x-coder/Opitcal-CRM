# Record New Purchase form improvements

Completed and checked on 22 October 2026.

## Files changed for this request

| File                                                            | Change                                                                                                                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/components/customers/AddPurchaseDialog.tsx`         | Extracted the purchase dialog; added matching purchase/pricing cards, explicit prescription choices, compact read-only customer summary and field-level errors. |
| `client/src/components/customers/ProductAutocomplete.tsx`       | Shared searchable catalog/manual-text control.                                                                                                                  |
| `client/src/components/customers/OpticalPrescriptionFields.tsx` | Shared prescription table and SPH/CYL/AXIS controls.                                                                                                            |
| `client/src/utils/opticalForm.ts`                               | Extracted Add Customer's eye ordering, power options, validation, parsing, product labels and catalog search helpers.                                           |
| `client/src/utils/newPurchaseForm.ts`                           | Typed purchase state, price preview, validation and API payload preparation.                                                                                    |
| `client/src/utils/customerHistory.ts`                           | Removed the separate prescription draft implementation in favor of the shared Add Customer helpers.                                                             |
| `client/src/pages/AddCustomerPage.tsx`                          | Uses extracted controls/helpers; retains personal fields, registration request, pricing behavior and navigation.                                                |
| `client/src/pages/CustomerDetailPage.tsx`                       | Mounts the extracted dialog and immediately merges its saved purchase and returned prescription into history.                                                   |
| `client/src/models/customer.ts`                                 | Types the purchase response's optional linked prescription.                                                                                                     |
| `client/src/services/customerApi.ts`                            | Shares identical concurrent save requests and clears them on success/failure.                                                                                   |
| `server/src/services/customerHistoryService.ts`                 | Returns the exact linked prescription with the saved purchase using Prisma's relation include.                                                                  |
| `server/tests/newPurchaseForm.test.ts`                          | New form, rendering, dropdown, pricing, prescription-choice and repeated-request tests.                                                                         |
| `server/tests/customerHistoryClient.test.ts`                    | Tests the shared optical parsing/validation helpers.                                                                                                            |
| `server/tests/purchaseService.test.ts`                          | Added failure propagation and realistic POST-to-details-reload coverage.                                                                                        |

Other existing workspace edits were preserved. This request added no dependency, migration, endpoint, customer-personal-information form or unrelated page redesign.

## Entry behavior

Add Customer and Record New Purchase now render the same prescription table and use the same product inputs. The shared table preserves the original RE DIST, RE NEAR, LE DIST and LE NEAR order and SPH/CYL/AXIS columns. Right and left eyes are labeled explicitly, with OD/OS included in accessible field names.

SPH and CYL have visible searchable dropdowns in quarter-diopter steps and permit manually typed signed decimal values. Axis retains Add Customer's numeric-input behavior and 0–180 validation. Blank values remain absent, and zero is retained. The existing database's optical precision and measurement structure are unchanged.

Frame and lens fields use Material UI `Autocomplete` with `freeSolo`, a visible dropdown, keyboard selection support, and `clearOnBlur={false}`. Choosing a catalog item stores its ID and Add Customer's exact label. Typing or clearing disconnects only that product's catalog ID. Search includes product codes and metadata. Lens company, name, vision type and coating remain one combined lens description, matching Add Customer and existing storage; no separate coating field was invented.

Purchase date, actual-product classification, split pricing, total-MRP pricing and paise-safe totals remain available. Switching pricing or prescription mode preserves entered values, while only the active mode is sent to the backend. Saving displays validation messages beside the relevant fields.

## Prescription choices and saving

- **Link Existing Prescription:** lists this customer's recorded prescriptions and sends the selected ID. The existing record is reused without copying or modifying it.
- **Enter New Prescription:** displays the shared twelve-field table and sends the existing `re_dist`, `re_near`, `le_dist`, `le_near` structure. Incomplete optional groups are allowed. If every measurement is blank, no prescription is sent or created, matching Add Customer's optional-entry behavior.
- **No Prescription:** sends a null prescription ID and no new measurements, even if another mode has an unsaved draft.

The dialog calls the existing authenticated `POST /api/customers/:id/records` workflow. It does not call customer creation. The backend continues to validate the active customer/shop, catalog references, pricing and prescription ownership. A new prescription and its purchase remain inside one Prisma transaction, so failures reject the operation rather than report success after only one part saved.

The response now includes its exact linked prescription. Customer Details immediately inserts the returned purchase and merges that prescription by ID, then reloads database history. Existing ordering, latest-purchase highlighting, totals, comparison, vision progression and receipt linking continue to use the same records. No manual browser reload is required by this success path.

A synchronous form lock blocks repeated submits, disabled controls prevent editing during a save, and identical concurrent client requests share one promise. The in-flight request entry is removed on both success and failure. This is protection against repeated clicks in the current client, not persistent cross-browser idempotency after a lost response.

## Verification

`rtk npm run check` passed:

- Repository formatting, frontend ESLint and backend/tooling TypeScript checks.
- **97 automated tests passed, 0 failed**, including nine additional tests for this request.
- Frontend TypeScript/Vite build and backend Prisma-generation/TypeScript build.
- **1 compiled-server smoke test passed**.
- Prisma schema validation.

Focused coverage includes catalog/custom product labels, frame-only/lens-only/combined purchases, both pricing modes, positive/negative/zero powers, optional and missing measurements, invalid axis/pricing inputs, all prescription choices, save failures, duplicate concurrent requests, and realistic purchase POST responses followed by customer-details GET requests. The HTTP/service tests use mocked database operations.

A server-rendered component test verifies all twelve shared prescription fields, eight power comboboxes, four numeric axis inputs and visible dropdown controls. Existing customer-creation, personal-editing, historical-purchase, prescription comparison, document privacy and receipt-linking regressions also pass.

A separate **read-only check of the configured live database passed**: an existing customer's history reloaded through `getCustomerById`, and a purchase's included prescription matched both its saved prescription ID and customer ID. No customer details or credentials were logged, and no live records were written.

## Remaining verification limits

The computer/browser inventory contained no browser. Actual mouse/keyboard/Enter interactions, mobile visual layout, browser console inspection, authenticated browser saves and a newly written live-database record were not tested. Add Customer's extracted UI was build/lint/regression checked, but was not manually submitted in a browser. These checks remain appropriate in a development environment with a browser.

Prescription dates still mean when a prescription was recorded; the existing schema has no separate examination-date field. Existing prescriptions are labeled accordingly.

To rerun the available checks from the project root:

```powershell
rtk npm run check
```
