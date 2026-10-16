
/**
 * Optical CRM — Dashboard Demo Seed
 *
 * nik - Keep the previous six-month demo data.
 * nik - Add 18 purchases in 2024 and 18 in 2025.
 * nik - Never delete or overwrite existing records.
 * nik - Skip records already created by an earlier run.
 */

import "dotenv/config";
import { prisma } from "../src/config/database";

const SHOP_CODE = "DEMO_SHOP";

const phones = [
  "7878562841",
  "9773447735",
  "7698382174",
  "6358246173",
];

const names = [
  "Aarav Sharma",
  "Priya Patel",
  "Rohan Mehta",
  "Sneha Shah",
  "Aditya Joshi",
  "Neha Desai",
  "Kunal Verma",
  "Riya Kulkarni",
  "Vivek Patil",
  "Ananya Singh",
  "Rahul Jain",
  "Pooja Shah",
  "Harsh Patel",
  "Kavya Mehta",
  "Nikhil Sharma",
  "Simran Desai",
  "Yash Joshi",
  "Meera Jain",
];

const frames = [
  "Titan Full Rim",
  "Vincent Chase Rectangle",
  "Lenskart Air",
  "John Jacobs Round",
  "Fastrack Metal",
  "Classic Acetate Frame",
];

const lenses = [
  "Single Vision",
  "Blue Cut",
  "Progressive",
  "Anti-Glare",
  "Photochromic",
  "Bifocal",
];

// nik - Choose varied sample values consistently.
function pick<T>(items: T[], index: number): T {
  return items[index % items.length];
}

// nik - Track how many records were added or skipped.
let created = 0;
let skipped = 0;

// nik - Reuse the same creation method for all demo years.
async function addDemoPurchase(
  shopId: string,
  demoId: string,
  index: number,
  purchaseDate: Date
) {
  // nik - Avoid duplicate records when rerunning the seed.
  const existing = await prisma.customer.findFirst({
    where: {
      shopId,
      legacyMongoId: demoId,
    },
    select: { id: true },
  });

  if (existing || purchaseDate > new Date()) {
    skipped++;
    return;
  }

  // nik - Vary prices to make the charts meaningful.
  const frameRate = 550 + (index % 9) * 275;
  const lensRate = 450 + (index % 8) * 225;
  const total = frameRate + lensRate;

  const splitPricing = index % 2 === 0;

  const frame =
    index % 5 === 0 ? null : pick(frames, index);

  const lens =
    index % 7 === 0 ? null : pick(lenses, index);

  // nik - Customer and purchase are saved together.
  await prisma.customer.create({
    data: {
      shopId,
      name: `[DEMO] ${pick(names, index)} ${demoId.slice(-8)}`,
      mobNumber: pick(phones, index),
      gender: null,
      reference: "Dashboard Analytics Demo",
      notes: "Temporary data for analytics testing.",
      legacyMongoId: demoId,

      records: {
        create: {
          legacyMongoId: demoId,
          specsType: frame,
          lensType: lens,
          pricingMode: splitPricing ? "SPLIT" : "MRP_ONLY",
          frameRate: splitPricing ? frameRate : null,
          lensRate: splitPricing ? lensRate : null,
          mrp: total,
          purchaseDate,
        },
      },
    },
  });

  created++;
}

async function main() {
  const shop = await prisma.shop.findUnique({
    where: { code: SHOP_CODE },
    select: { id: true },
  });

  if (!shop) {
    throw new Error(
      "DEMO_SHOP was not found. Check your database."
    );
  }

  // -------------------------------------------------
  // PART 1 — KEEP PREVIOUS SIX-MONTH DEMO DATA
  // -------------------------------------------------

  const now = new Date();

  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const monthStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - monthOffset,
        1
      )
    );

    const year = monthStart.getUTCFullYear();
    const month = monthStart.getUTCMonth();

    for (let index = 0; index < 6; index++) {
      const number = (5 - monthOffset) * 6 + index;

      // nik - Preserve IDs from the previous seed.
      const demoId =
        `dashboard-demo-${year}-${String(
          month + 1
        ).padStart(2, "0")}-${index + 1}`;

      const purchaseDate = new Date(
        Date.UTC(year, month, 3 + index * 4)
      );

      await addDemoPurchase(
        shop.id,
        demoId,
        number,
        purchaseDate
      );
    }
  }

  // -------------------------------------------------
  // PART 2 — ADD 2024 AND 2025 ANALYTICS DATA
  // -------------------------------------------------

  for (const year of [2024, 2025]) {
    // nik - Generate 18 purchases for each year.
    for (let index = 0; index < 18; index++) {
      // nik - Spread purchases across all 12 months.
      const month = index % 12;

      // nik - Use different days within the months.
      const day = 3 + (index % 5) * 5;

      const purchaseDate = new Date(
        Date.UTC(year, month, day)
      );

      // nik - Stable IDs make the script safe to rerun.
      const demoId =
        `dashboard-history-${year}-${String(
          index + 1
        ).padStart(2, "0")}`;

      // nik - Give historical records varied prices,
      // products, names and phone numbers.
      const globalIndex =
        (year - 2024) * 18 + index + 50;

      await addDemoPurchase(
        shop.id,
        demoId,
        globalIndex,
        purchaseDate
      );
    }
  }

  console.log("\nDashboard demo seed completed.");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log("Existing customer records were not modified.");
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
