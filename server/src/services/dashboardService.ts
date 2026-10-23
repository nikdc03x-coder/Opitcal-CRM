import { prisma } from "../config/database";
import { getShopId } from "./shopService";
import { shopToday } from "../utils/date";

const DEFAULT_HISTORY_YEARS = 3;
type PurchaseType = "Frame Only" | "Lens Only" | "Frame + Lens" | "Not Specified";
type Aggregate = {
  year: number;
  month: number;
  category: PurchaseType;
  purchases: bigint;
  value: unknown;
};
type YearAnalytics = {
  year: number;
  purchases: number;
  value: number;
  months: { month: number; purchases: number; value: number }[];
  categories: Record<PurchaseType, number>;
};

function emptyYear(year: number): YearAnalytics {
  return {
    year,
    purchases: 0,
    value: 0,
    months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, purchases: 0, value: 0 })),
    categories: { "Frame Only": 0, "Lens Only": 0, "Frame + Lens": 0, "Not Specified": 0 },
  };
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// PostgreSQL returns monthly/category aggregates instead of every purchase row.
// All values in this query are bound parameters; no identifiers come from input.
export async function getDashboardAnalytics() {
  const shopId = await getShopId();
  const today = shopToday();
  const currentYear = today.getUTCFullYear();
  const defaultFirstYear = currentYear - DEFAULT_HISTORY_YEARS + 1;
  const [totalCustomers, groups, recentRecords] = await Promise.all([
    prisma.customer.count({ where: { shopId, isActive: true, deletedAt: null } }),
    prisma.$queryRaw<Aggregate[]>`
      SELECT EXTRACT(YEAR FROM r."purchaseDate")::int AS year,
             EXTRACT(MONTH FROM r."purchaseDate")::int AS month,
             CASE
               WHEN NULLIF(r."specsType", '') IS NOT NULL AND NULLIF(r."lensType", '') IS NOT NULL THEN 'Frame + Lens'
               WHEN NULLIF(r."specsType", '') IS NOT NULL THEN 'Frame Only'
               WHEN NULLIF(r."lensType", '') IS NOT NULL THEN 'Lens Only'
               ELSE 'Not Specified'
             END AS category,
             COUNT(*)::bigint AS purchases, SUM(r.mrp) AS value
      FROM "CustomerRecord" AS r
      JOIN "Customer" AS c ON c.id = r."customerId"
      WHERE c."shopId" = ${shopId} AND c."isActive" = TRUE AND c."deletedAt" IS NULL AND r."deletionGroupId" IS NULL AND r."deletedAt" IS NULL AND r."purchaseDate" <= ${today}
      GROUP BY 1, 2, 3 ORDER BY 1, 2
    `,
    prisma.customerRecord.findMany({
      where: {
        deletionGroupId: null,
        deletedAt: null,
        customer: { shopId, isActive: true, deletedAt: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
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
  const firstYear = groups.reduce((first, group) => Math.min(first, group.year), defaultFirstYear);
  const years = Array.from({ length: currentYear - firstYear + 1 }, (_, i) =>
    emptyYear(firstYear + i),
  );
  const byYear = new Map(years.map((year) => [year.year, year]));
  for (const group of groups) {
    const year = byYear.get(group.year);
    if (!year || group.month < 1 || group.month > 12) continue;
    const value = Number(group.value);
    const purchases = Number(group.purchases);
    const month = year.months[group.month - 1];
    year.purchases += purchases;
    year.value += value;
    month.purchases += purchases;
    month.value += value;
    year.categories[group.category] += value;
  }
  return {
    currentYear,
    defaultFirstYear,
    defaultHistoryYears: DEFAULT_HISTORY_YEARS,
    totalCustomers,
    years: years.map((year) => ({
      year: year.year,
      purchases: year.purchases,
      value: money(year.value),
      months: year.months.map((month) => ({ ...month, value: money(month.value) })),
      categories: Object.entries(year.categories).map(([name, value]) => ({
        name,
        value: money(value),
      })),
    })),
    recent: recentRecords.map((record) => ({
      id: record.id,
      customerId: record.customer.id,
      customerName: record.customer.name,
      frame: record.specsType,
      lens: record.lensType,
      value: Number(record.mrp),
      purchaseDate: record.purchaseDate,
    })),
  };
}
