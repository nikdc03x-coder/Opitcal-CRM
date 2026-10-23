import assert from "node:assert/strict";
import { prisma } from "../../src/config/database";
import { Prisma } from "../../src/generated/prisma/client";
import { getShopId } from "../../src/services/shopService";
import { getDashboardAnalytics } from "../../src/services/dashboardService";
import { parseAnalyticsQuery } from "../../src/validators/analyticsValidator";
import * as analytics from "../../src/services/analyticsService";
import { purchaseMixSql, summaryFor } from "../../src/services/analyticsQueries";

// nik - This audit only reads existing records; it prints checks rather than customer details.
async function main() {
  // nik - VALUES fixtures exercise production SQL without inserting even temporary records.
  const mixes = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
    WITH fixture(has_frame, has_lens) AS (VALUES (TRUE, FALSE), (FALSE, TRUE), (TRUE, TRUE), (FALSE, FALSE))
    SELECT ${purchaseMixSql} AS name FROM fixture`);
  assert.deepEqual(
    mixes.map((row) => row.name),
    ["Frame Only", "Lens Only", "Frame + Lens", "Unclassified"],
  );
  const ages = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
    WITH fixture(recorded_age) AS (VALUES (0), (17), (18), (25), (26), (35), (36), (50), (51), (65), (66), (120), (NULL), (121), (-1))
    SELECT ${analytics.age} AS name FROM fixture`);
  assert.deepEqual(
    ages.map((row) => row.name),
    [
      "Under 18",
      "Under 18",
      "18–25",
      "18–25",
      "26–35",
      "26–35",
      "36–50",
      "36–50",
      "51–65",
      "51–65",
      "Above 65",
      "Above 65",
      "Unknown",
      "Unknown",
      "Unknown",
    ],
  );
  const genders = await prisma.$queryRaw<{ name: string }[]>(Prisma.sql`
    WITH fixture(gender) AS (VALUES (' MALE '), ('female'), ('Other'), (''), (NULL), ('unrecognized'))
    SELECT ${analytics.gender} AS name FROM fixture`);
  assert.deepEqual(
    genders.map((row) => row.name),
    ["Male", "Female", "Other", "Unknown", "Unknown", "Unknown"],
  );
  const distinct =
    await summaryFor(Prisma.sql`WITH filtered(customer_id, mobile, mrp, has_frame, has_lens, mix, purchase_date) AS (
    VALUES ('id-1', 'shared-mobile', 0.10::numeric, TRUE, FALSE, 'Frame Only', '2024-02-29'::date),
      ('id-2', 'shared-mobile', 0.20::numeric, FALSE, TRUE, 'Lens Only', NULL::date))`);
  assert.equal(distinct.customers, 2);
  assert.equal(Number(distinct.value), 0.3);
  assert.equal(distinct.undated, 1);
  console.log(JSON.stringify({ classificationAgeGenderAndSharedPhoneFixturesVerified: true }));
  const query = parseAnalyticsQuery({ period: "all" });
  const shopId = await getShopId();
  const baseline = await prisma.customerRecord.aggregate({
    where: { customer: { shopId } },
    _count: { _all: true },
    _sum: { mrp: true },
  });
  const overview = await analytics.getAnalyticsOverview(query);
  assert.equal(overview.summary.purchases, baseline._count._all);
  assert.equal(Number(overview.summary.value), Number(baseline._sum.mrp ?? 0));
  assert.equal(
    overview.summary.frameOnly +
      overview.summary.lensOnly +
      overview.summary.both +
      overview.summary.unclassified,
    overview.summary.purchases,
  );
  console.log(
    JSON.stringify({ overviewTotalsVerified: true, classificationPartitionsVerified: true }),
  );
  const first = await analytics.getAnalyticsPurchases({ ...query, pageSize: 1 });
  assert.equal(first.total, overview.summary.purchases);
  assert.equal(first.summary.value, overview.summary.value);
  if (first.total > 1) {
    const second = await analytics.getAnalyticsPurchases({ ...query, page: 2, pageSize: 1 });
    assert.notEqual(first.rows[0].id, second.rows[0].id);
  }
  const dated = first.rows.find((row) => row.purchaseDate);
  if (dated?.purchaseDate) {
    const exact = await analytics.getAnalyticsPurchases(
      parseAnalyticsQuery({ period: "date", date: dated.purchaseDate, pageSize: "100" }),
    );
    assert.ok(exact.rows.every((row) => row.purchaseDate === dated.purchaseDate));
  }
  console.log(JSON.stringify({ purchasePaginationAndDateVerified: true }));
  for (const kind of ["frames", "lenses"] as const) {
    const products = await analytics.getAnalyticsProducts(query, kind);
    assert.equal(
      products.containing,
      kind === "frames" ? overview.summary.frames : overview.summary.lenses,
    );
    assert.ok(
      Object.values(products.rankings).every((rows) =>
        rows.every((row) => row.share >= 0 && row.share <= 100),
      ),
    );
  }
  const customers = await analytics.getAnalyticsCustomers(query);
  assert.equal(
    customers.gender.registered.reduce((sum, row) => sum + row.count, 0),
    customers.registered,
  );
  assert.equal(
    customers.gender.purchasing.reduce((sum, row) => sum + row.count, 0),
    overview.summary.customers,
  );
  assert.equal(
    customers.gender.purchases.reduce((sum, row) => sum + row.count, 0),
    overview.summary.purchases,
  );
  assert.equal(
    customers.ages.reduce((sum, row) => sum + row.count, 0),
    customers.registered,
  );
  const mix = await analytics.getAnalyticsMix(query);
  assert.equal(
    mix.mix.reduce((sum, row) => sum + row.purchases, 0),
    overview.summary.purchases,
  );
  await analytics.getAnalyticsComparison(
    parseAnalyticsQuery({ period: "month", comparePeriod: "lastMonth" }),
  );
  const historical = await analytics.getAnalyticsHistorical();
  assert.ok(historical.years.every((year) => year.months.length === 12));
  const existing = await getDashboardAnalytics();
  assert.equal(historical.totalCustomers, existing.totalCustomers);
  for (const year of historical.years) {
    const original = existing.years.find((row) => row.year === year.year)!;
    assert.equal(year.purchases, original.purchases);
    assert.ok(new Prisma.Decimal(year.value).equals(original.value));
    for (const month of year.months) {
      assert.equal(month.purchases, original.months[month.month - 1].purchases);
      assert.ok(new Prisma.Decimal(month.value).equals(original.months[month.month - 1].value));
    }
  }
  console.log(JSON.stringify({ originalExplorerKpiAndMonthlyValueParityVerified: true }));
  console.log(JSON.stringify({ productsCustomersMixComparisonAndHistoryVerified: true }));
  let lines = 0,
    footer = "";
  await analytics.exportAnalyticsPurchases(query, async (chunk) => {
    lines += chunk.split("\r\n").length - 1;
    footer = chunk;
    return true;
  });
  // CSV cells may contain quoted newlines; totals, rather than line counts, remain authoritative.
  assert.ok(lines >= overview.summary.purchases + 2);
  assert.ok(footer.startsWith('"TOTAL"'));
  assert.ok(footer.includes(`"${new Prisma.Decimal(overview.summary.value).toFixed(2)}"`));
  console.log(JSON.stringify({ fullFilteredCsvVerified: true, writesPerformed: false }));
}
main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        analyticsAuditFailed: true,
        code: error?.code ?? error?.name ?? "UNEXPECTED",
        assertion: error?.name === "AssertionError" ? error.message : undefined,
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
