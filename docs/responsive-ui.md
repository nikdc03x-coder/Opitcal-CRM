# Responsive CRM UI

This pass changes frontend layout, styling, and navigation presentation. Existing form state, validation, API calls, pricing, analytics calculations, and deletion/restore handlers are preserved. No backend or database changes were made for this task. Earlier workspace changes remain intact.

## Behavior

- Below 900px: the sidebar starts hidden. The header opens a temporary drawer; outside clicks, Escape, the close control, and selecting a link close it.
- At 900–1199px: navigation initially uses a 72px icon rail, with tooltips and accessible labels. Users can expand it.
- At 1200px and above: navigation initially shows the existing 250px sidebar. The header control toggles between expanded and collapsed views. The current page and customer subpages stay highlighted.
- Content uses the available width with responsive padding and bounded desktop reading widths.
- Customer headers stack on phones; long names, references, dates, and validation messages wrap. Purchase totals stay together.
- Registration retains all four steps, existing inputs, review, validation, and saving behavior. Narrow action rows fit without fixed button widths forcing overflow.
- Prescription inputs retain usable column widths and scroll within focusable table regions. Clinical progression tables retain readable columns. OD/OS, Distance/Near, powers, and axes remain unchanged.
- Purchase, receipt, order, and catalog forms use full-screen dialogs below 600px. Confirmation dialogs remain compact. Dialog content scrolls and actions wrap within the viewport.
- Analytics filters use the available phone width. Existing responsive chart grids, legends, report navigation, historical views, comparisons, and datasets remain present.
- Shared defaults improve cards, typography, tabs, tables, pagination, notifications, dropdowns, focus indicators, and touch targets. Customer search, Dashboard, Edit Customer, Trash, login, and the missing-page screen benefit from these defaults without replacing their workflows.

## Files changed for this task

| Area                  | Files                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared layout         | `client/src/components/layout/AppLayout.tsx`, `ResponsiveDialog.tsx`                                                                                                                         |
| Theme                 | `client/src/theme/theme.ts`                                                                                                                                                                  |
| Customer presentation | `client/src/pages/AddCustomerPage.tsx`, `CustomerDetailPage.tsx`; `client/src/components/customers/OpticalPrescriptionFields.tsx`, `AddPurchaseDialog.tsx`                                   |
| Orders and catalog    | `client/src/pages/OrdersPage.tsx`, `AdminCatalogPage.tsx`; `client/src/components/orders/CreateOrderDialog.tsx`, `OrderDetailsDialog.tsx`                                                    |
| Analytics             | `client/src/components/analytics/AnalyticsFilters.tsx`, `AnalyticsSections.tsx`, `HistoricalSalesExplorer.tsx`, `SalesReports.tsx`; `client/src/components/dashboard/DashboardAnalytics.tsx` |
| Verification          | `scripts/check-responsive.mjs`, this document                                                                                                                                                |

The unused display-only declarations in Customer Details were removed, and MUI styling props in the registration review were moved into `sx` to resolve frontend TypeScript/lint errors. No business rules were changed.

## Verification

- Final headless browser pass: **305 responsive states passed**, with no page overflow, content extending past the viewport, or JavaScript runtime exceptions. Screenshots were inspected at phone, tablet, and desktop sizes.
- `npm --prefix client run build`: TypeScript and production bundle pass.
- `npm --prefix client run lint`: passes.
- Existing client/utility and analytics regression tests: 37 of 38 pass. The existing failure at `server/tests/newPurchaseForm.test.ts:248` expects blank frame prices to be invalid, whereas the current form utility permits optional blank prices. This task intentionally preserves that validation behavior.
- Browser checks use headless Edge with synthetic long customer/product names, prescriptions, purchases, orders, Trash entries, and nonempty analytics. API writes are blocked by the harness; it never connects to Neon.
- Requested widths: 320, 375, 425, 768, 1024, 1280, and 1920px. Checks cover all routes, registration steps, validation, purchase/prescription dialogs, customer detail/edit tabs, receipt preview, frame/lens dialogs, order details/confirmation, PIN disabled state, all analytics sections, transactions, comparisons, and customer behavior.
- Navigation checks exercise desktop toggle, mobile opening, Escape, outside click, and selecting a route. Layout checks measure document overflow and content extending beyond the viewport; screenshots are captured for visual inspection.
- Customer search is exercised through the URL-preserving input. Catalog dropdown placement and product selection are checked before entering a frame price and reviewing registration.
- A 640×450 CSS viewport at device scale 2 checks reflow equivalent to a 1280×900 display at 200% zoom. This is emulation, not a browser toolbar zoom test. A 320×450 purchase dialog checks reduced viewport height and footer visibility.

To repeat locally after building:

```powershell
rtk proxy npm --prefix client run build
rtk proxy node scripts/check-responsive.mjs
```

The harness requires Node 24 and local Edge (or set `RESPONSIVE_BROWSER` to a Chromium executable). It uses localhost ports 5178 and 9238 and writes screenshots/results to ignored `artifacts/responsive/`. `RESPONSIVE_WIDTHS` can restrict a diagnostic run, for example `320,768,1920`.

Local review artifacts:

- [Browser results](../artifacts/responsive/results.json)
- [Phone customer profile](../artifacts/responsive/320-detail.png)
- [Phone prescription purchase form](../artifacts/responsive/320-purchase-prescription.png)
- [Phone catalog dropdown](../artifacts/responsive/320-catalog-dropdown.png)
- [Phone analytics chart](../artifacts/responsive/320-analytics-chart.png)
- [Tablet customer details](../artifacts/responsive/768-detail.png)
- [Desktop collapsed navigation](../artifacts/responsive/1920-navigation-toggled.png)

## Limits

Browser testing uses synthetic fixtures, not live saves or deletions. Physical iOS/Android browsers, their software keyboards, native date pickers, and actual browser-toolbar zoom still need device testing. Separate settings/import screens do not exist in this checkout, so no such screens were added or removed. This frontend task does not establish deployment or database readiness.
