
import { prisma } from "../config/database";

// nik - Use the same shop as the existing CRM modules.
const SHOP_CODE = "DEMO_SHOP";

// nik - Show at least the current year and two previous years.
// Keep older years available whenever purchase history exists.
const DEFAULT_HISTORY_YEARS = 3;

type Month = {
  month: number;
  purchases: number;
  value: number;
};

type PurchaseType =
  | "Frame Only"
  | "Lens Only"
  | "Frame + Lens"
  | "Not Specified";

type YearAnalytics = {
  year: number;
  purchases: number;
  value: number;
  months: Month[];
  categories: Record<PurchaseType, number>;
};

// nik - Group purchases by their recorded product selection.
function purchaseType(
  frame: string | null,
  lens: string | null
): PurchaseType {
  if (frame && lens) return "Frame + Lens";
  if (frame) return "Frame Only";
  if (lens) return "Lens Only";
  return "Not Specified";
}

// nik - Round calculated money values to two decimal places.
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// nik - Create an empty year containing all 12 months.
// Empty years and months should display zero, not disappear.
function createEmptyYear(year: number): YearAnalytics {
  return {
    year,
    purchases: 0,
    value: 0,

    months: Array.from(
      { length: 12 },
      (_, index): Month => ({
        month: index + 1,
        purchases: 0,
        value: 0,
      })
    ),

    categories: {
      "Frame Only": 0,
      "Lens Only": 0,
      "Frame + Lens": 0,
      "Not Specified": 0,
    },
  };
}

// nik - Return real purchase analytics for all historical years.
// The latest three years always remain available for comparison.
export async function getDashboardAnalytics() {
  const shop = await prisma.shop.findUnique({
    where: { code: SHOP_CODE },
    select: { id: true },
  });

  if (!shop) {
    throw new Error("CRM shop not found.");
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  // nik - The default reporting window moves automatically.
  // Example: 2026 -> 2024-2026; 2027 -> 2025-2027.
  const defaultFirstYear =
    currentYear - DEFAULT_HISTORY_YEARS + 1;

  // nik - Read current and historical purchases.
  // Future-dated purchases are excluded until their date arrives.
  const [
    totalCustomers,
    records,
    recentRecords,
  ] = await Promise.all([
    prisma.customer.count({
      where: {
        shopId: shop.id,
        isActive: true,
      },
    }),

    prisma.customerRecord.findMany({
      where: {
        customer: {
          shopId: shop.id,
        },
        purchaseDate: {
          lte: now,
        },
      },
      select: {
        purchaseDate: true,
        mrp: true,
        specsType: true,
        lensType: true,
      },
    }),

    prisma.customerRecord.findMany({
      where: {
        customer: {
          shopId: shop.id,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        mrp: true,
        purchaseDate: true,
        specsType: true,
        lensType: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  // nik - Find the earliest available purchase year.
  // If no purchase exists, start with the default three years.
  let firstYear = defaultFirstYear;

  for (const record of records) {
    if (!record.purchaseDate) continue;

    const purchaseYear =
      record.purchaseDate.getUTCFullYear();

    if (purchaseYear < firstYear) {
      firstYear = purchaseYear;
    }
  }

  // nik - Build every year between the earliest purchase
  // and the current year. Do not lose historical years.
  const years: YearAnalytics[] = [];

  for (
    let year = firstYear;
    year <= currentYear;
    year++
  ) {
    years.push(createEmptyYear(year));
  }

  // nik - Find a year quickly while grouping records.
  const yearMap = new Map<number, YearAnalytics>();

  for (const year of years) {
    yearMap.set(year.year, year);
  }

  // nik - Calculate monthly totals, annual totals
  // and the product-category breakdown.
  for (const record of records) {
    const purchaseDate = record.purchaseDate;

    if (!purchaseDate) continue;

    const purchaseYear =
      purchaseDate.getUTCFullYear();

    const purchaseMonth =
      purchaseDate.getUTCMonth();

    const year = yearMap.get(purchaseYear);

    if (!year) continue;

    const month = year.months[purchaseMonth];

    const value = Number(record.mrp);

    // nik - Ignore invalid amount values in calculations.
    if (!Number.isFinite(value)) continue;

    year.purchases += 1;
    year.value += value;

    month.purchases += 1;
    month.value += value;

    const category = purchaseType(
      record.specsType,
      record.lensType
    );

    year.categories[category] += value;
  }

  // nik - Convert calculated values into API-friendly data.
  const formattedYears = years.map((year) => ({
    year: year.year,
    purchases: year.purchases,
    value: roundMoney(year.value),

    months: year.months.map((month) => ({
      month: month.month,
      purchases: month.purchases,
      value: roundMoney(month.value),
    })),

    categories: Object.entries(
      year.categories
    ).map(([name, value]) => ({
      name,
      value: roundMoney(value),
    })),
  }));

  // nik - Send only the information needed by the dashboard.
  return {
    currentYear,

    // nik - The frontend can use these to show the latest
    // three years by default without hiding older history.
    defaultFirstYear,
    defaultHistoryYears: DEFAULT_HISTORY_YEARS,

    totalCustomers,

    // nik - All historical years, ordered oldest to newest.
    years: formattedYears,

    // nik - Keep the existing recent-purchase display.
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
