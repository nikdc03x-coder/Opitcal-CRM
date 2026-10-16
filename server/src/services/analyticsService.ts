import { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/database";
import { getShopId } from "./shopService";
import { shopToday } from "../utils/date";
import type { AnalyticsQuery } from "../validators/analyticsValidator";
import {
  reportingPeriod,
  precedingPeriod,
  comparisonPeriod,
} from "../validators/analyticsValidator";
import type {
  AnalyticsCustomers,
  AnalyticsHistorical,
  AnalyticsHistoricalYear,
  AnalyticsMix,
  AnalyticsOverview,
  AnalyticsPeriod,
  AnalyticsPoint,
  AnalyticsProducts,
  AnalyticsPurchase,
  AnalyticsPurchases,
  AnalyticsComparison,
  AnalyticsDistribution,
} from "../models/analytics";
import {
  analyticsCte,
  changeBetween,
  periodWhere,
  queryObject,
  queryRows,
  ranking,
  rankColumns,
  summaryFor,
} from "./analyticsQueries";

async function context(query: AnalyticsQuery) {
  const shopId = await getShopId();
  const period = reportingPeriod(query);
  return { shopId, period, cte: analyticsCte(shopId, period, query) };
}

async function trend(
  cte: Prisma.Sql,
  period: AnalyticsPeriod,
  kind?: "frames" | "lenses",
): Promise<AnalyticsPoint[]> {
  const daily =
    period.from && period.to && Date.parse(period.to) - Date.parse(period.from) < 62 * 86400000;
  const grain = daily
    ? Prisma.sql`purchase_date`
    : Prisma.sql`DATE_TRUNC('month', purchase_date)::date`;
  const end = daily
    ? grain
    : Prisma.sql`(DATE_TRUNC('month', purchase_date) + INTERVAL '1 month - 1 day')::date`;
  return queryRows(
    cte,
    Prisma.sql`
    SELECT ${grain}::text AS label, SUM(mrp)::text AS value, COUNT(*)::int AS purchases,
      COUNT(DISTINCT customer_id)::int AS customers, ${grain}::text AS "from", ${end}::text AS "to"
    FROM filtered WHERE purchase_date IS NOT NULL
      AND ${kind === "frames" ? Prisma.sql`has_frame` : kind === "lenses" ? Prisma.sql`has_lens` : Prisma.sql`TRUE`}
    GROUP BY 1, 5, 6 ORDER BY 1
  `,
  );
}

export async function getAnalyticsOverview(query: AnalyticsQuery): Promise<AnalyticsOverview> {
  const { shopId, period, cte } = await context(query);
  const previousPeriod = precedingPeriod(period);
  const [summary, activeCustomers, points, mix, frames, lenses, previousSummary] =
    await Promise.all([
      summaryFor(cte),
      prisma.customer.count({ where: { shopId, isActive: true } }),
      trend(cte, period),
      ranking(cte, "mix", 4),
      ranking(cte, "frame", 5, "frames"),
      ranking(cte, "lens", 5, "lenses"),
      previousPeriod ? summaryFor(analyticsCte(shopId, previousPeriod, query)) : null,
    ]);
  return {
    period,
    summary,
    activeCustomers,
    trend: points,
    mix,
    frames,
    lenses,
    calculatedAt: new Date().toISOString(),
    previous:
      previousPeriod && previousSummary
        ? {
            period: previousPeriod,
            summary: previousSummary,
            change: changeBetween(summary, previousSummary),
          }
        : null,
  };
}

const purchaseSelection = Prisma.sql`id, customer_id AS "customerId", customer_name AS "customerName", mobile,
  purchase_date::text AS "purchaseDate", frame, lens, pricing_mode AS "pricingMode",
  CASE WHEN pricing_mode = 'SPLIT' THEN frame_rate::text END AS "frameRate",
  CASE WHEN pricing_mode = 'SPLIT' THEN lens_rate::text END AS "lensRate", mrp::text AS mrp`;
function purchaseOrder(query: AnalyticsQuery) {
  const column =
    query.sort === "customer"
      ? Prisma.sql`customer_name`
      : query.sort === "amount"
        ? Prisma.sql`mrp`
        : Prisma.sql`purchase_date`;
  return Prisma.sql`${column} ${query.direction === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`} NULLS LAST, id ASC`;
}
export async function getAnalyticsPurchases(query: AnalyticsQuery): Promise<AnalyticsPurchases> {
  const { period, cte } = await context(query);
  // nik - Summary and page use the same SQL statement/snapshot; totals never stop at the page size.
  const result = await queryObject<{
    summary: AnalyticsPurchases["summary"];
    rows: AnalyticsPurchase[];
  }>(
    cte,
    Prisma.sql`
    SELECT (SELECT JSONB_BUILD_OBJECT(
      'purchases', COUNT(*)::int, 'value', COALESCE(SUM(mrp), 0)::text, 'customers', COUNT(DISTINCT customer_id)::int,
      'average', COALESCE(ROUND(AVG(mrp), 2), 0)::text, 'highest', COALESCE(MAX(mrp), 0)::text,
      'frames', COUNT(*) FILTER (WHERE has_frame)::int, 'lenses', COUNT(*) FILTER (WHERE has_lens)::int,
      'frameOnly', COUNT(*) FILTER (WHERE mix = 'Frame Only')::int, 'lensOnly', COUNT(*) FILTER (WHERE mix = 'Lens Only')::int,
      'both', COUNT(*) FILTER (WHERE mix = 'Frame + Lens')::int, 'unclassified', COUNT(*) FILTER (WHERE mix = 'Unclassified')::int,
      'undated', COUNT(*) FILTER (WHERE purchase_date IS NULL)::int) FROM filtered) AS summary,
      (SELECT COALESCE(JSONB_AGG(TO_JSONB(page)), '[]') FROM (
        SELECT ${purchaseSelection} FROM filtered ORDER BY ${purchaseOrder(query)} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      ) page) AS rows
  `,
  );
  return {
    period,
    ...result,
    total: result.summary.purchases,
    page: query.page,
    pageSize: query.pageSize,
    calculatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsComparison(query: AnalyticsQuery): Promise<AnalyticsComparison> {
  const { shopId, period, cte } = await context(query);
  const other = comparisonPeriod(query, period);
  const [summary, comparison] = await Promise.all([
    summaryFor(cte),
    summaryFor(analyticsCte(shopId, other, query)),
  ]);
  return {
    period,
    summary,
    comparison: { period: other, summary: comparison },
    change: changeBetween(summary, comparison),
    calculatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsProducts(
  query: AnalyticsQuery,
  kind: "frames" | "lenses",
): Promise<AnalyticsProducts> {
  const { period, cte } = await context(query);
  const dimensions =
    kind === "frames"
      ? (["brand", "model", "style", "frame"] as const)
      : (["company", "name", "vision", "coating", "lens"] as const);
  const condition = kind === "frames" ? Prisma.sql`has_frame` : Prisma.sql`has_lens`;
  const price = kind === "frames" ? Prisma.sql`frame_rate` : Prisma.sql`lens_rate`;
  const [summary, points, product, groups, options, visionCounts] = await Promise.all([
    summaryFor(cte),
    trend(cte, period, kind),
    queryObject<{ containing: number; splitValue: string; totalOnly: number }>(
      cte,
      Prisma.sql`
      SELECT COUNT(*)::int AS containing, COALESCE(SUM(${price}) FILTER (WHERE pricing_mode = 'SPLIT'), 0)::text AS "splitValue",
        COUNT(*) FILTER (WHERE pricing_mode = 'MRP_ONLY')::int AS "totalOnly" FROM filtered WHERE ${condition}
    `,
    ),
    Promise.all(
      dimensions.map(
        async (dimension) => [dimension, await ranking(cte, dimension, query.top, kind)] as const,
      ),
    ),
    Promise.all(
      (kind === "frames" ? (["brand", "style"] as const) : (["company", "vision"] as const)).map(
        async (dimension) => {
          const rows = await queryRows<{ name: string }>(
            cte,
            Prisma.sql`SELECT DISTINCT ${rankColumns[dimension]} AS name FROM classified WHERE ${condition} ORDER BY 1`,
          );
          return [dimension, rows.map((row) => row.name)] as const;
        },
      ),
    ),
    kind === "lenses"
      ? queryRows<{ name: string; count: number }>(
          cte,
          Prisma.sql`SELECT vision_type AS name, COUNT(*)::int AS count FROM filtered WHERE has_lens GROUP BY 1`,
        )
      : [],
  ]);
  return {
    period,
    summary,
    kind,
    ...product,
    trend: points,
    rankings: Object.fromEntries(groups),
    options: Object.fromEntries(options),
    visionCounts: Object.fromEntries(visionCounts.map((row) => [row.name, row.count])),
    calculatedAt: new Date().toISOString(),
  };
}

export const gender = Prisma.sql`CASE LOWER(BTRIM(gender)) WHEN 'male' THEN 'Male' WHEN 'female' THEN 'Female' WHEN 'other' THEN 'Other' ELSE 'Unknown' END`;
export const age = Prisma.sql`CASE WHEN recorded_age BETWEEN 0 AND 17 THEN 'Under 18' WHEN recorded_age BETWEEN 18 AND 25 THEN '18–25'
  WHEN recorded_age BETWEEN 26 AND 35 THEN '26–35' WHEN recorded_age BETWEEN 36 AND 50 THEN '36–50'
  WHEN recorded_age BETWEEN 51 AND 65 THEN '51–65' WHEN recorded_age BETWEEN 66 AND 120 THEN 'Above 65' ELSE 'Unknown' END`;
function distribution(
  rows: { name: string; count: number }[],
  categories: string[],
): AnalyticsDistribution[] {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return categories.map((name) => {
    const count = rows.find((row) => row.name === name)?.count ?? 0;
    return { name, count, share: total ? Math.round((count / total) * 10000) / 100 : 0 };
  });
}

export async function getAnalyticsCustomers(query: AnalyticsQuery): Promise<AnalyticsCustomers> {
  const { shopId, period, cte } = await context(query);
  const registeredWhere = Prisma.sql`"shopId" = ${shopId}`;
  const registrationDate = Prisma.sql`("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date`;
  const [
    summary,
    profiles,
    registeredGender,
    buyersGender,
    purchasesGender,
    ages,
    frequency,
    registrations,
    activity,
  ] = await Promise.all([
    summaryFor(cte),
    queryObject<{ registered: number; active: number; newRegistrations: number }>(
      Prisma.empty,
      Prisma.sql`
      SELECT COUNT(*)::int AS registered, COUNT(*) FILTER (WHERE "isActive")::int AS active,
        COUNT(*) FILTER (WHERE ${periodWhere(period, registrationDate)})::int AS "newRegistrations" FROM "Customer" WHERE ${registeredWhere}`,
    ),
    queryRows<{ name: string; count: number }>(
      Prisma.empty,
      Prisma.sql`SELECT ${gender} AS name, COUNT(*)::int AS count FROM "Customer" WHERE ${registeredWhere} GROUP BY 1`,
    ),
    queryRows<{ name: string; count: number }>(
      cte,
      Prisma.sql`SELECT ${gender} AS name, COUNT(DISTINCT customer_id)::int AS count FROM filtered GROUP BY 1`,
    ),
    queryRows<{ name: string; count: number }>(
      cte,
      Prisma.sql`SELECT ${gender} AS name, COUNT(*)::int AS count FROM filtered GROUP BY 1`,
    ),
    queryRows<{ name: string; count: number }>(
      Prisma.sql`WITH ages AS (SELECT "ageAtRecording" AS recorded_age FROM "Customer" WHERE ${registeredWhere})`,
      Prisma.sql`SELECT ${age} AS name, COUNT(*)::int AS count FROM ages GROUP BY 1`,
    ),
    queryRows<{ name: string; count: number }>(
      cte,
      Prisma.sql`SELECT CASE WHEN visits >= 4 THEN '4+' ELSE visits::text END AS name, COUNT(*)::int AS count FROM (SELECT COUNT(*) AS visits FROM filtered GROUP BY customer_id) visits GROUP BY 1`,
    ),
    queryRows<{ label: string; count: number }>(
      Prisma.empty,
      Prisma.sql`SELECT TO_CHAR(${registrationDate}, 'YYYY-MM') AS label, COUNT(*)::int AS count FROM "Customer" WHERE ${registeredWhere} AND ${periodWhere(period, registrationDate)} GROUP BY 1 ORDER BY 1`,
    ),
    queryRows<{ label: string; customers: number; repeat: number; purchases: number }>(
      cte,
      Prisma.sql`
      SELECT label, COUNT(*)::int AS customers, COUNT(*) FILTER (WHERE visits > 1)::int AS repeat, SUM(visits)::int AS purchases FROM (
        SELECT TO_CHAR(purchase_date, 'YYYY-MM') AS label, customer_id, COUNT(*)::int AS visits FROM filtered WHERE purchase_date IS NOT NULL GROUP BY 1, 2
      ) visits GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  const genderCategories = ["Male", "Female", "Other", "Unknown"];
  const ageDistribution = distribution(ages, [
    "Under 18",
    "18–25",
    "26–35",
    "36–50",
    "51–65",
    "Above 65",
    "Unknown",
  ]);
  const missingAge = ageDistribution.find((row) => row.name === "Unknown")!.count;
  return {
    period,
    summary,
    ...profiles,
    repeat: frequency.filter((row) => row.name !== "1").reduce((sum, row) => sum + row.count, 0),
    gender: {
      registered: distribution(registeredGender, genderCategories),
      purchasing: distribution(buyersGender, genderCategories),
      purchases: distribution(purchasesGender, genderCategories),
    },
    ages: ageDistribution,
    missingAge,
    ageCoverage: profiles.registered
      ? Math.round(((profiles.registered - missingAge) / profiles.registered) * 10000) / 100
      : 0,
    frequency: distribution(frequency, ["1", "2", "3", "4+"]),
    registrations,
    activity,
    calculatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsMix(query: AnalyticsQuery): Promise<AnalyticsMix> {
  const { period, cte } = await context(query);
  const [summary, mix, combinations, points] = await Promise.all([
    summaryFor(cte),
    ranking(cte, "mix", 4),
    ranking(cte, "combination", query.top),
    queryRows<AnalyticsMix["trend"][number]>(
      cte,
      Prisma.sql`
      SELECT TO_CHAR(purchase_date, 'YYYY-MM') AS label,
        COUNT(*) FILTER (WHERE mix = 'Frame Only')::int AS "frameOnly", COUNT(*) FILTER (WHERE mix = 'Lens Only')::int AS "lensOnly",
        COUNT(*) FILTER (WHERE mix = 'Frame + Lens')::int AS both, COUNT(*) FILTER (WHERE mix = 'Unclassified')::int AS unclassified
      FROM filtered WHERE purchase_date IS NOT NULL GROUP BY 1 ORDER BY 1`,
    ),
  ]);
  return {
    period,
    summary,
    mix,
    combinations,
    trend: points,
    calculatedAt: new Date().toISOString(),
  };
}

export async function getAnalyticsHistorical(): Promise<AnalyticsHistorical> {
  const shopId = await getShopId(),
    today = shopToday(),
    currentYear = today.getUTCFullYear();
  const [totalCustomers, groups, recent] = await Promise.all([
    prisma.customer.count({ where: { shopId, isActive: true } }),
    prisma.$queryRaw<
      {
        year: number;
        month: number;
        category: string;
        purchases: number;
        value: string;
        elapsedValue: string;
      }[]
    >`
      SELECT EXTRACT(YEAR FROM r."purchaseDate")::int AS year, EXTRACT(MONTH FROM r."purchaseDate")::int AS month,
        CASE WHEN NULLIF(r."specsType", '') IS NOT NULL AND NULLIF(r."lensType", '') IS NOT NULL THEN 'Frame + Lens'
          WHEN NULLIF(r."specsType", '') IS NOT NULL THEN 'Frame Only' WHEN NULLIF(r."lensType", '') IS NOT NULL THEN 'Lens Only' ELSE 'Not Specified' END AS category,
        COUNT(*)::int AS purchases, SUM(r.mrp)::text AS value,
        COALESCE(SUM(r.mrp) FILTER (WHERE r."purchaseDate" <=
          (MAKE_DATE(EXTRACT(YEAR FROM r."purchaseDate")::int, ${today.getUTCMonth() + 1}, 1)
           + (LEAST(${today.getUTCDate()}, EXTRACT(DAY FROM (MAKE_DATE(EXTRACT(YEAR FROM r."purchaseDate")::int, ${today.getUTCMonth() + 1}, 1) + INTERVAL '1 month - 1 day'))::int) - 1))), 0)::text AS "elapsedValue"
      FROM "CustomerRecord" r JOIN "Customer" c ON c.id = r."customerId"
      WHERE c."shopId" = ${shopId} AND r."purchaseDate" <= ${today} GROUP BY 1, 2, 3 ORDER BY 1, 2
    `,
    prisma.customerRecord.findMany({
      where: { customer: { shopId } },
      take: 5,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        mrp: true,
        purchaseDate: true,
        specsType: true,
        lensType: true,
        customer: { select: { id: true, name: true } },
      },
    }),
  ]);
  const firstYear = groups.reduce((first, row) => Math.min(first, row.year), currentYear - 2);
  const years: AnalyticsHistoricalYear[] = Array.from(
    { length: currentYear - firstYear + 1 },
    (_, i) => ({
      year: firstYear + i,
      purchases: 0,
      value: "0.00",
      elapsedValue: "0.00",
      months: Array.from({ length: 12 }, (_, index) => ({
        month: index + 1,
        purchases: 0,
        value: "0.00",
      })),
      categories: ["Frame Only", "Lens Only", "Frame + Lens", "Not Specified"].map((name) => ({
        name,
        value: "0.00",
      })),
    }),
  );
  // nik - Decimal sums retain paise when merging already-aggregated monthly/category groups.
  const add = (left: string, right: string) => new Prisma.Decimal(left).plus(right).toFixed(2);
  for (const row of groups) {
    const year = years[row.year - firstYear],
      month = year?.months[row.month - 1];
    if (!year || !month) continue;
    year.purchases += row.purchases;
    year.value = add(year.value, row.value);
    year.elapsedValue = add(year.elapsedValue, row.elapsedValue);
    month.purchases += row.purchases;
    month.value = add(month.value, row.value);
    const category = year.categories.find((item) => item.name === row.category);
    if (category) category.value = add(category.value, row.value);
  }
  return {
    today: today.toISOString().slice(0, 10),
    currentYear,
    totalCustomers,
    years,
    recent: recent.map((row) => ({
      id: row.id,
      customerId: row.customer.id,
      customerName: row.customer.name,
      frame: row.specsType,
      lens: row.lensType,
      value: row.mrp.toString(),
      purchaseDate: row.purchaseDate?.toISOString().slice(0, 10) ?? null,
    })),
  };
}

// nik - CSV data is generated in bounded batches from a stable read-only cursor, never a page-limited report.
export async function exportAnalyticsPurchases(
  query: AnalyticsQuery,
  write: (chunk: string) => Promise<boolean>,
): Promise<void> {
  const { cte } = await context(query);
  const csv = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const headers = [
    "Purchase Date",
    "Customer Name",
    "Mobile",
    "Frame",
    "Lens",
    "Pricing Mode",
    "Frame Rate",
    "Lens Rate",
    "Total MRP",
    "Customer ID",
    "Purchase ID",
  ];
  await prisma.$transaction(
    async (tx) => {
      // nik - One read-only cursor gives every batch the same snapshot and the requested sort order.
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw(
        Prisma.sql`DECLARE analytics_export NO SCROLL CURSOR FOR ${cte} SELECT ${purchaseSelection} FROM filtered ORDER BY ${purchaseOrder(query)}`,
      );
      if (!(await write("\uFEFF" + headers.map(csv).join(",") + "\r\n"))) return;
      let total = new Prisma.Decimal(0);
      while (true) {
        const rows = await tx.$queryRaw<
          AnalyticsPurchase[]
        >`FETCH FORWARD 500 FROM analytics_export`;
        if (!rows.length) break;
        let chunk = "";
        for (const row of rows) {
          total = total.plus(row.mrp);
          chunk +=
            [
              row.purchaseDate,
              row.customerName,
              row.mobile,
              row.frame,
              row.lens,
              row.pricingMode,
              row.frameRate,
              row.lensRate,
              row.mrp,
              row.customerId,
              row.id,
            ]
              .map(csv)
              .join(",") + "\r\n";
        }
        if (!(await write(chunk))) return;
      }
      await write(
        ["TOTAL", "", "", "", "", "", "", "", total.toFixed(2), "", ""].map(csv).join(",") + "\r\n",
      );
    },
    { isolationLevel: "RepeatableRead", timeout: 120000, maxWait: 10000 },
  );
}
