import "dotenv/config";
import { prisma } from "../../src/config/database";
import { migrationUrl } from "../../src/config/databaseConfig";
import { getDashboardAnalytics } from "../../src/services/dashboardService";

// Read-only verification. Never print connection strings, sessions or CRM records.
async function main() {
  migrationUrl();
  const required = [
    "Shop",
    "Customer",
    "Prescription",
    "CustomerRecord",
    "FrameCatalog",
    "LensCatalog",
    "admins",
    "AdminSession",
    "Order",
    "OrderStatusHistory",
  ];
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `;
  const present = new Set(tables.map((table) => table.table_name));
  const missing = required.filter((table) => !present.has(table));
  console.log(JSON.stringify({ neonConnected: true, missingTables: missing }));
  if (missing.length) throw new Error("Required tables are missing.");
  // nik - A generated Prisma client can compile while the deployed database still lacks new columns.
  const ageColumns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Customer'
      AND column_name IN ('ageAtRecording', 'ageRecordedAt')
  `;
  const presentColumns = new Set(ageColumns.map((column) => column.column_name));
  const missingCustomerColumns = ["ageAtRecording", "ageRecordedAt"].filter(
    (column) => !presentColumns.has(column),
  );
  console.log(JSON.stringify({ missingCustomerColumns }));
  if (missingCustomerColumns.length) {
    throw new Error("Customer age migration has not been deployed.");
  }
  const startedAt = performance.now();
  const analytics = await getDashboardAnalytics();
  console.log(
    JSON.stringify({
      analyticsVerified: true,
      reportingYears: analytics.years.length,
      elapsedMs: Math.round(performance.now() - startedAt),
    }),
  );
}

main()
  .catch(() => {
    console.error(
      "Neon audit failed. Check connectivity, verified TLS, and deployed migrations. No credentials were logged.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
