# OptiLens Intelligence

## Baseline and preservation checklist

Checkpoint: `5f85648`; implementation branch: `phase-09-optilens-intelligence`.

- [x] Monthly and yearly analysis; all supported historical years.
- [x] Last 3, last 5, all years and custom yearly ranges.
- [x] Comparison switch, remembered comparison year and distinct series/legends.
- [x] Bar, line and product-breakdown pie charts, precise tooltips and INR labels.
- [x] Active Customers = current active profiles, independent of the reporting period.
- [x] Selected-year purchase count and value = dated purchases, saved MRP.
- [x] Year-on-year change, safe zero denominator and equivalent elapsed periods.
- [x] Existing customer links and recent-purchase access.
- [x] Dashboard, sidebar, customer workflows, orders, auth and database schema unchanged.

## Implementation plan and file boundaries

1. Add analytics-only models, validators, services, controller and routes; register the protected router in `server/src/app.ts`.
2. Preserve the Explorer in `client/src/components/analytics/HistoricalSalesExplorer.tsx`; leave the original dashboard component and endpoint intact.
3. Add shared MUI filters, cards/charts, page-scoped request reuse and report views under `client/src/components/analytics`.
4. Replace only `BusinessAnalyticsPage.tsx`; add analytics API/types/utilities, focused tests and this documentation.

No migrations, source-data edits, new dependencies or Python/ML features.

## Calculation definitions

- Purchase value is `CustomerRecord.mrp`, never cash collected or profit. PostgreSQL numeric arithmetic retains monetary precision; API money values are decimal strings.
- Purchase dates are PostgreSQL DATE values. Date ranges are inclusive and never fall back to creation time. Current calendar periods use Asia/Kolkata.
- All Time includes undated purchases in totals and explicitly reports their count. Time-series charts exclude undated purchases.
- A purchase contains a product when its saved description is nonblank or its catalog reference resolves within the same shop. Catalog joins are one-to-one and shop-scoped. Blank/missing attributes remain Unknown.
- Product counts are purchase records containing products, not physical quantities. Only saved SPLIT rates contribute separate frame/lens values.
- Purchasing customers are counted by customer UUID, never by phone. Repeat purchasers have at least two matching purchases in the chosen period. Monthly repeat trends count customers with at least two purchases in that month.
- Registered customer distributions include inactive profiles. Purchasing-customer and purchase distributions have separate denominators. Recorded age is an observation at its recording date, not age at a historical purchase.
- Historical YoY uses full years for completed years. The current year uses matching month/day cutoffs in both years (leap days clamp to month end). This corrects the old UTC-month-only comparison, which included the entire comparison month.
- New reports include recorded future purchase dates when explicitly selected; the preserved historical Explorer stops at the shop's current day, as before.
- CSV exports contain only the visible purchase-report fields, neutralize spreadsheet formulas and include a full-filter total row. Prescriptions and internal notes are never selected.

## Validation record

- PASS: `rtk proxy npm run check` — formatting, frontend ESLint, backend/tooling TypeScript, 74 regression tests (13 analytics tests), backend/frontend production builds, compiled backend smoke test, Prisma validation.
- PASS: `auditAnalytics.ts` against the configured Neon database, using read-only queries only. Full-filter totals match independent Prisma aggregates. All original Explorer active-customer, annual and monthly values match the untouched dashboard service.
- PASS: SQL VALUES fixtures cover all four purchase classifications; all age boundaries, missing/invalid ages, gender normalization and unknown values; two different customer IDs sharing a mobile; paise totals and undated counting. No fixtures are inserted.
- PASS: full CSV cursor export totals and pagination against actual stored data; a 501-row automated cursor fixture also verifies there is no 20-row limit and spreadsheet formulas are neutralized.
- PASS: headless Edge browser regression with isolated API fixtures: Overview-only initial request, all six tabs, bar/line/pie selection, monthly/yearly and custom year range controls, historical year selection, remembered comparison, exact tooltip values, chart and product-ranking drill-downs, exact-date search/sort/pagination, CSV download, empty state, error/retry and 390-pixel mobile overflow check. No browser runtime errors.
- PASS: protected analytics/CSV endpoints return 401 without authentication. Query validation rejects invalid dates/ranges, sorting injection, arrays and excessive page sizes.
- PASS: `git diff --quiet 5f85648 --` over the protected customer, billing, prescription/document, order, auth, dashboard/sidebar, route and Prisma-schema/migration paths. Only `server/src/app.ts` receives the new authenticated analytics router registration.

Browser fixtures test interactions separately from the read-only real-database audit; no live customer login was automated. Screenshots are ignored development artifacts under `artifacts/analytics/`.

## Run and verify (Windows Git Bash)

Run from the repository root. These commands do not apply migrations or edit records.

```bash
rtk proxy git switch phase-09-optilens-intelligence
rtk proxy npm run check

# Optional read-only verification against the configured Neon database:
(cd server && rtk proxy node --import tsx scripts/database/auditAnalytics.ts)

# Terminal 1:
rtk proxy npm run dev:server
# Terminal 2:
rtk proxy npm run dev:client
```

Open `http://localhost:5173/analytics` after signing in normally. No database migration is required.

For the optional headless UI checks, run Vite on the isolated test port in one terminal:

```bash
rtk proxy npm --prefix client run dev -- --host 127.0.0.1 --port 5175 --strictPort
# In another terminal (requires installed Microsoft Edge; npm caches the optional test runner):
rtk proxy npm exec --yes --package=playwright -- node client/tests/analytics-ui.cjs
```

Open the implementation and documentation:

```bash
rtk proxy code client/src/pages/BusinessAnalyticsPage.tsx client/src/components/analytics server/src/services/analyticsService.ts server/src/services/analyticsQueries.ts docs/optilens-intelligence.md
```

## Data limitations

Brand/model/style/vision/coating reports use the current verified catalog attributes because purchase records do not snapshot those separate attributes. Historical frame/lens descriptions remain the saved descriptions. Missing metadata is Unknown. Quantities, payment collection and profitability are unavailable and are never inferred. Recorded ages describe observations, not historical ages.

The report cache is bounded, memory-only and scoped to the analytics page. Abandoned requests are cancelled; Refresh Reports invalidates cached reports. CSV exports use a read-only repeatable-read cursor, 500-row batches and a two-minute transaction budget.

## Complete changed-file list

- [client/src/components/analytics/AnalyticsData.tsx](../client/src/components/analytics/AnalyticsData.tsx)
- [client/src/components/analytics/AnalyticsFilters.tsx](../client/src/components/analytics/AnalyticsFilters.tsx)
- [client/src/components/analytics/AnalyticsSections.tsx](../client/src/components/analytics/AnalyticsSections.tsx)
- [client/src/components/analytics/AnalyticsUi.tsx](../client/src/components/analytics/AnalyticsUi.tsx)
- [client/src/components/analytics/HistoricalSalesExplorer.tsx](../client/src/components/analytics/HistoricalSalesExplorer.tsx)
- [client/src/components/analytics/SalesReports.tsx](../client/src/components/analytics/SalesReports.tsx)
- [client/src/components/analytics/reportStore.ts](../client/src/components/analytics/reportStore.ts)
- [client/src/models/analytics.ts](../client/src/models/analytics.ts)
- [client/src/pages/BusinessAnalyticsPage.tsx](../client/src/pages/BusinessAnalyticsPage.tsx)
- [client/src/services/analyticsApi.ts](../client/src/services/analyticsApi.ts)
- [client/src/utils/analytics.ts](../client/src/utils/analytics.ts)
- [client/tests/analytics-ui.cjs](../client/tests/analytics-ui.cjs)
- [docs/optilens-intelligence.md](../docs/optilens-intelligence.md)
- [server/scripts/database/auditAnalytics.ts](../server/scripts/database/auditAnalytics.ts)
- [server/src/app.ts](../server/src/app.ts)
- [server/src/controllers/analyticsController.ts](../server/src/controllers/analyticsController.ts)
- [server/src/models/analytics.ts](../server/src/models/analytics.ts)
- [server/src/routes/analyticsRoutes.ts](../server/src/routes/analyticsRoutes.ts)
- [server/src/services/analyticsQueries.ts](../server/src/services/analyticsQueries.ts)
- [server/src/services/analyticsService.ts](../server/src/services/analyticsService.ts)
- [server/src/validators/analyticsValidator.ts](../server/src/validators/analyticsValidator.ts)
- [server/tests/analytics.test.ts](../server/tests/analytics.test.ts)
