import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import {
  parseAnalyticsQuery,
  reportingPeriod,
  precedingPeriod,
  comparisonPeriod,
} from "../src/validators/analyticsValidator";
import {
  analyticsMoney,
  historicalChange,
  reportParams,
  yearColor,
} from "../../client/src/utils/analytics";
import { analyticsUrl } from "../../client/src/services/analyticsApi";
import type { AnalyticsHistorical, AnalyticsSummary } from "../src/models/analytics";

test("analytics calendar presets use India dates across month/year boundaries", () => {
  const now = new Date("2025-12-31T18:30:00Z");
  const period = (name: string) => reportingPeriod(parseAnalyticsQuery({ period: name }), now);
  assert.deepEqual(period("today"), { from: "2026-01-01", to: "2026-01-01", label: "2026-01-01" });
  assert.equal(period("yesterday").from, "2025-12-31");
  assert.equal(period("last7").from, "2025-12-26");
  assert.equal(period("lastMonth").from, "2025-12-01");
  assert.equal(period("lastMonth").to, "2025-12-31");
  assert.equal(period("year").from, "2026-01-01");
  assert.equal(period("all").from, null);
});

test("exact dates, leap months, historical years and inclusive previous periods are valid", () => {
  const exact = reportingPeriod(parseAnalyticsQuery({ period: "date", date: "2024-02-29" }));
  assert.equal(exact.from, exact.to);
  assert.equal(
    reportingPeriod(parseAnalyticsQuery({ period: "selectedMonth", month: "2024-02" })).to,
    "2024-02-29",
  );
  assert.equal(
    reportingPeriod(parseAnalyticsQuery({ period: "selectedYear", year: "2004" })).from,
    "2004-01-01",
  );
  const range = reportingPeriod(
    parseAnalyticsQuery({ period: "custom", from: "2026-01-01", to: "2026-01-07" }),
  );
  assert.deepEqual(precedingPeriod(range), {
    from: "2025-12-25",
    to: "2025-12-31",
    label: "2025-12-25 to 2025-12-31",
  });
  assert.equal(
    comparisonPeriod(
      parseAnalyticsQuery({ period: "month", comparePeriod: "selectedYear", compareYear: "2020" }),
      range,
    ).to,
    "2020-12-31",
  );
});

test("analytics input rejects impossible dates, reversed ranges, arrays, unsafe sorting and oversized pages", () => {
  for (const query of [
    { period: "date", date: "2026-02-29" },
    { period: "date" },
    { period: "custom", from: "2026-02-02", to: "2026-02-01" },
    { page: "0" },
    { page: "1.2" },
    { pageSize: "101" },
    { sort: "mrp; DROP TABLE" },
    { direction: "DESC NULLS FIRST" },
    { search: ["name", "phone"] },
    { brand: {} },
    { top: "1000" },
    { unknown: "field" },
    { period: "selectedMonth", month: "0000-01" },
  ])
    assert.throws(() => parseAnalyticsQuery(query));
  assert.equal(parseAnalyticsQuery({ page: "50", pageSize: "100" }).page, 50);
  assert.equal(
    parseAnalyticsQuery({ coating: "x".repeat(200), frame: "x".repeat(301) }).coating?.length,
    200,
  );
});

test("report filters do not leak hidden date fields or overwrite explorer selections", () => {
  const filters = {
    period: "date",
    date: "2004-01-02",
    from: "2026-01-01",
    to: "2026-01-31",
    month: "2026-01",
    year: "2026",
  };
  assert.deepEqual(reportParams(filters), { period: "date", date: "2004-01-02" });
  assert.equal(
    analyticsUrl("purchases", { search: "a & b", page: 2 }),
    "/api/analytics/purchases?page=2&search=a+%26+b",
  );
  assert.notEqual(yearColor(2020), yearColor(2026));
});

test("exact rupee formatting keeps paise and Indian grouping even for large totals", () => {
  assert.equal(analyticsMoney("123456789012345678.90"), "₹1,23,45,67,89,01,23,45,678.90");
  assert.equal(analyticsMoney("0.10"), "₹0.10");
  assert.equal(analyticsMoney("-20.25"), "−₹20.25");
});

test("historical YoY uses equivalent-day totals for the current year and full totals for older years", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { calculateHistoricalChange } = await import("../src/services/analyticsService");
  const data = {
    currentYear: 2026,
    years: [
      { year: 2024, value: "100", elapsedValue: "1" },
      { year: 2025, value: "200", elapsedValue: "50.25" },
      { year: 2026, value: "100.50", elapsedValue: "100.50" },
    ],
  } as AnalyticsHistorical;
  for (const year of data.years)
    year.yearOnYear = calculateHistoricalChange(data.years, year.year, data.currentYear);
  assert.equal(historicalChange(data, 2026), 100);
  assert.equal(historicalChange(data, 2025), 100);
  data.years[1].elapsedValue = "0";
  data.years[2].yearOnYear = calculateHistoricalChange(data.years, 2026, data.currentYear);
  assert.equal(historicalChange(data, 2026), null);
});

test("analytics SQL binds every filter and verifies both catalog joins against the shop", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { analyticsCte } = await import("../src/services/analyticsQueries");
  const query = parseAnalyticsQuery({
    period: "date",
    date: "2026-01-01",
    search: "'; DROP TABLE customers; --",
    brand: "Other shop brand",
  });
  const sql = analyticsCte("authorized-shop", reportingPeriod(query), query);
  assert.ok(sql.values.includes("authorized-shop"));
  assert.ok(sql.values.includes("Other shop brand"));
  assert.equal(sql.text.includes("DROP TABLE"), false);
  assert.match(sql.text, /f\."shopId" = c\."shopId"/);
  assert.match(sql.text, /l\."shopId" = c\."shopId"/);
  assert.match(sql.text, /purchase_date BETWEEN/);
  assert.match(sql.text, /c\."isActive" = TRUE/);
  assert.match(sql.text, /r\."deletionGroupId" IS NULL/);
});

test("period differences retain decimal accuracy and safely handle zero denominators", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { changeBetween } = await import("../src/services/analyticsQueries");
  const base = { value: "0.10", average: "0.10", purchases: 1 } as AnalyticsSummary;
  const result = changeBetween({ ...base, value: "0.30", average: "0.15", purchases: 2 }, base);
  assert.deepEqual(result, { value: "0.20", percent: 200, average: "0.05", purchases: 1 });
  assert.equal(changeBetween(base, { ...base, value: "0" }).percent, null);
});

test("CSV export reads every cursor batch, preserves sort, totals paise and excludes sensitive fields", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const { exportAnalyticsPurchases } = await import("../src/services/analyticsService");
  const statements: string[] = [];
  const row = {
    id: "purchase",
    customerId: "customer",
    customerName: '=HYPERLINK("bad")',
    mobile: "9876543210",
    purchaseDate: "2026-01-01",
    frame: "Frame",
    lens: "Lens",
    pricingMode: "MRP_ONLY",
    frameRate: null,
    lensRate: null,
    mrp: "0.10",
  };
  const pages = [Array.from({ length: 500 }, () => row), [row], []];
  const tx = {
    $executeRaw: async (sql: { text?: string } | TemplateStringsArray) => {
      statements.push(Array.isArray(sql) ? sql.join("") : (sql as { text: string }).text);
      return 0;
    },
    $queryRaw: async () => pages.shift(),
  };
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop" }));
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (client: unknown) => unknown) =>
    callback(tx),
  );
  const chunks: string[] = [];
  await exportAnalyticsPurchases(
    parseAnalyticsQuery({ period: "all", sort: "amount", direction: "asc" }),
    async (chunk) => {
      chunks.push(chunk);
      return true;
    },
  );
  const csv = chunks.join("");
  assert.equal(csv.split("\r\n").length - 1, 503);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(chunks.at(-1)?.includes('"50.10"'));
  assert.equal(statements[0], "SET TRANSACTION READ ONLY");
  assert.match(statements[1], /mrp ASC NULLS LAST/);
  assert.equal(/notes|prescription/i.test(statements[1]), false);
  assert.equal(/LIMIT 20/.test(statements[1]), false);
});

test("every analytics and CSV endpoint requires authentication", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { default: app } = await import("../src/app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const report of [
      "overview",
      "historical",
      "purchases",
      "purchases.csv",
      "comparison",
      "frames",
      "lenses",
      "customers",
      "mix",
    ]) {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/analytics/${report}`,
      );
      assert.equal(response.status, 401, report);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("invalid report inputs return actionable 400s before any database lookup", async () => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { default: router } = await import("../src/routes/analyticsRoutes");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  const app = express();
  app.use(router);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const path of [
      "/purchases?period=date&date=2026-02-29",
      "/purchases?period=custom",
      "/frames?pageSize=1001",
      "/purchases.csv?period=custom",
    ]) {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`,
      );
      assert.equal(response.status, 400, path);
      assert.equal((await response.json()).success, false);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("analytics request reuse is lazy, deduplicates StrictMode subscribers and reuses completed reports", async (t) => {
  const { AnalyticsStore } = await import("../../client/src/components/analytics/reportStore");
  const request = t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ success: true, data: { marker: "overview" } }), {
        status: 200,
      }),
  );
  const store = new AnalyticsStore(),
    entry = store.entry("/api/analytics/overview");
  assert.equal(request.mock.calls.length, 0);
  const first = store.subscribe(entry, () => {});
  first();
  const second = store.subscribe(entry, () => {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(request.mock.calls.length, 1);
  assert.deepEqual(entry.snapshot.data, { marker: "overview" });
  second();
  store.subscribe(store.entry("/api/analytics/overview"), () => {});
  assert.equal(request.mock.calls.length, 1);
  store.refresh();
  store.subscribe(store.entry("/api/analytics/overview"), () => {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(request.mock.calls.length, 2);
});

test("analytics cancels abandoned filters and stale responses cannot replace a newer report", async (t) => {
  const { AnalyticsStore } = await import("../../client/src/components/analytics/reportStore");
  const pending: { signal: AbortSignal; resolve: (value: Response) => void }[] = [];
  t.mock.method(
    globalThis,
    "fetch",
    (_url: unknown, options: RequestInit) =>
      new Promise<Response>((resolve) => pending.push({ signal: options.signal!, resolve })),
  );
  const store = new AnalyticsStore(),
    old = store.entry("/old");
  const leave = store.subscribe(old, () => {});
  leave();
  const fresh = store.entry("/new");
  store.subscribe(fresh, () => {});
  await Promise.resolve();
  assert.equal(pending[0].signal.aborted, true);
  pending[0].resolve(new Response(JSON.stringify({ success: true, data: "old" })));
  pending[1].resolve(new Response(JSON.stringify({ success: true, data: "new" })));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(old.snapshot.data, undefined);
  assert.equal(fresh.snapshot.data, "new");
});
