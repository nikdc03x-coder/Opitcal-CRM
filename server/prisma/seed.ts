
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Only allow this dummy-data script in development.
if (process.env.NODE_ENV !== "development") {
  throw new Error("Dummy data can only be seeded in development.");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Fixed IDs make this script safe to run repeatedly.
// Each run updates the same dummy records.
const customers = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Rahul Sharma",
    mobNumber: "9876543210",
    gender: "Male",
    specsType: "Full Rim",
    lensType: "Blue Cut",
    frameRate: 1200,
    lensRate: 800,
    mrp: 2000,
    sph: -1.5,
    notes: "Prefers lightweight frames.",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Priya Sharma",
    mobNumber: "9876543210",
    gender: "Female",
    specsType: "Rimless",
    lensType: "Progressive",
    frameRate: 1800,
    lensRate: 1200,
    mrp: 3000,
    sph: -2.0,
    notes: "Shares a contact number with Rahul.",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Amit Patil",
    mobNumber: "9123456780",
    gender: "Male",
    specsType: "Half Rim",
    lensType: "Single Vision",
    frameRate: null,
    lensRate: null,
    mrp: 1500,
    sph: -0.75,
    notes: null,
  },
];

async function main() {
  // Create our default development shop once.
  const shop = await prisma.shop.upsert({
    where: { code: "DEMO_SHOP" },
    update: { name: "Optical CRM Demo Shop" },
    create: {
      code: "DEMO_SHOP",
      name: "Optical CRM Demo Shop",
    },
  });

  for (const item of customers) {
    // Create or update the customer profile.
    await prisma.customer.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        mobNumber: item.mobNumber,
        gender: item.gender,
        notes: item.notes,
      },
      create: {
        id: item.id,
        shopId: shop.id,
        name: item.name,
        mobNumber: item.mobNumber,
        gender: item.gender,
        notes: item.notes,
      },
    });

    // Give each customer a sample prescription.
    const prescriptionId = item.id.replace(
      "10000000",
      "20000000"
    );

    await prisma.prescription.upsert({
      where: { id: prescriptionId },
      update: { reDistSph: item.sph },
      create: {
        id: prescriptionId,
        customerId: item.id,
        reDistSph: item.sph,
        reDistCyl: -0.5,
        reDistAxis: 90,
        leDistSph: item.sph,
        leDistCyl: -0.25,
        leDistAxis: 180,
      },
    });

    // Create one purchase record for each customer.
    const recordId = item.id.replace(
      "10000000",
      "30000000"
    );

    await prisma.customerRecord.upsert({
      where: { id: recordId },
      update: {
        specsType: item.specsType,
        lensType: item.lensType,
        mrp: item.mrp,
      },
      create: {
        id: recordId,
        customerId: item.id,
        prescriptionId,
        specsType: item.specsType,
        lensType: item.lensType,
        pricingMode:
          item.frameRate === null ? "MRP_ONLY" : "SPLIT",
        frameRate: item.frameRate,
        lensRate: item.lensRate,
        mrp: item.mrp,
      },
    });
  }

  console.log("Demo shop and 3 customers seeded successfully.");
}

main()
  .catch((error) => {
    console.error("Database seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Close the database connection when finished.
    await prisma.$disconnect();
  });
