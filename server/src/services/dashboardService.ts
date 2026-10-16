
import { prisma } from "../config/database";

// nik - Use the same shop as the existing customer services.
const SHOP_CODE = "DEMO_SHOP";

// nik - Build one calendar month label.
function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

// nik - Calculate dashboard statistics from real records.
export async function getDashboardAnalytics() {
  const shop = await prisma.shop.findUnique({
    where: { code: SHOP_CODE },
    select: { id: true },
  });

  if (!shop) {
    throw new Error("CRM shop not found.");
  }

  const shopId = shop.id;

  const now = new Date();

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  // nik - Start six-month reporting at the first day
  // of the month, five months before this month.
  const chartStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)
  );

  const chartEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );

  // nik - Run independent database queries together.
  const [
    totalCustomers,
    totalPurchases,
    totalValue,
    recentMonthPurchases,
    monthlyRecords,
    recentRecords,
  ] = await Promise.all([
    prisma.customer.count({
      where: { shopId, isActive: true },
    }),

    prisma.customerRecord.count({
      where: { customer: { shopId } },
    }),

    prisma.customerRecord.aggregate({
      where: { customer: { shopId } },
      _sum: { mrp: true },
    }),

    prisma.customerRecord.count({
      where: {
        customer: { shopId },
        purchaseDate: { gte: thirtyDaysAgo, lte: now },
      },
    }),

    prisma.customerRecord.findMany({
      where: {
        customer: { shopId },
        purchaseDate: {
          gte: chartStart,
          lt: chartEnd,
        },
      },
      select: {
        mrp: true,
        purchaseDate: true,
      },
    }),

    prisma.customerRecord.findMany({
      where: { customer: { shopId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        mrp: true,
        purchaseDate: true,
        createdAt: true,
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

  // nik - Include months with zero purchases.
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      Date.UTC(
        chartStart.getUTCFullYear(),
        chartStart.getUTCMonth() + index,
        1
      )
    );

    return {
      month: monthKey(date),
      purchases: 0,
      value: 0,
    };
  });

  // nik - Group actual purchases by their purchase date.
  for (const record of monthlyRecords) {
    if (!record.purchaseDate) continue;

    const entry = monthly.find(
      (item) => item.month === monthKey(record.purchaseDate!)
    );

    if (entry) {
      entry.purchases += 1;
      entry.value += Number(record.mrp);
    }
  }

  // nik - Send only the information required by the UI.
  return {
    summary: {
      totalCustomers,
      totalPurchases,
      totalPurchaseValue: Number(totalValue._sum.mrp ?? 0),
      last30DaysPurchases: recentMonthPurchases,
    },
    monthly: monthly.map((item) => ({
      ...item,
      value: Math.round(item.value * 100) / 100,
    })),
    recent: recentRecords.map((record) => ({
      id: record.id,
      customerId: record.customer.id,
      customerName: record.customer.name,
      frame: record.specsType,
      lens: record.lensType,
      value: Number(record.mrp),
      purchaseDate: record.purchaseDate,
      createdAt: record.createdAt,
    })),
  };
}
