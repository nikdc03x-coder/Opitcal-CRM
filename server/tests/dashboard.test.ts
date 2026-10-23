import assert from "node:assert/strict";
import test from "node:test";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";

test("dashboard combines monthly SQL aggregates, keeps empty months and historical years, and binds the shop", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const { getDashboardAnalytics } = await import("../src/services/dashboardService");
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  mockPrismaMethod(t, prisma.customer, "count", async () => 42);
  const rows = [
    { year: 2020, month: 3, category: "Frame Only", purchases: 2n, value: "500.10" },
    { year: 2020, month: 3, category: "Lens Only", purchases: 1n, value: "100.20" },
    { year: 2020, month: 5, category: "Frame + Lens", purchases: 1n, value: "1500.00" },
  ];
  const query = mockPrismaMethod(t, prisma, "$queryRaw", async () => rows);
  const recent = mockPrismaMethod(t, prisma.customerRecord, "findMany", async () => []);
  const result = await getDashboardAnalytics();
  const history = result.years.find((year) => year.year === 2020)!;
  assert.equal(history.purchases, 4);
  assert.equal(history.value, 2100.3);
  assert.deepEqual(history.months[2], { month: 3, purchases: 3, value: 600.3 });
  assert.deepEqual(history.months[0], { month: 1, purchases: 0, value: 0 });
  assert.equal(history.categories.find((category) => category.name === "Lens Only")?.value, 100.2);
  assert.equal(result.totalCustomers, 42);
  assert.equal(result.years.at(-1)?.year, result.currentYear);
  const args = query.mock.calls[0].arguments;
  assert.equal(args[1], "shop-1");
  assert.ok(args[2] instanceof Date);
  assert.match(args[0].join(""), /SUM\(r.mrp\)/);
  assert.equal(
    recent.mock.calls[0].arguments[0].take,
    5,
    "Only recent purchases are loaded as individual rows",
  );
});

test("dashboard returns three complete empty years when no dated purchases exist", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const { getDashboardAnalytics } = await import("../src/services/dashboardService");
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  mockPrismaMethod(t, prisma.customer, "count", async () => 0);
  mockPrismaMethod(t, prisma, "$queryRaw", async () => []);
  mockPrismaMethod(t, prisma.customerRecord, "findMany", async () => []);
  const result = await getDashboardAnalytics();
  assert.equal(result.years.length, 3);
  assert.ok(
    result.years.every(
      (year) => year.value === 0 && year.purchases === 0 && year.months.length === 12,
    ),
  );
});
