import "dotenv/config";
import { Client } from "pg";
import { migrationUrl } from "../../src/config/databaseConfig";

async function main() {
  const db = new Client({
    connectionString: migrationUrl(),
    connectionTimeoutMillis: 30000,
    query_timeout: 30000,
  });
  await db.connect();
  try {
    const migrations = await db.query(
      'SELECT migration_name, finished_at IS NOT NULL AS applied, rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations" ORDER BY started_at',
    );
    const columns = await db.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('admins', 'PasswordResetToken', 'AccountRateLimit') ORDER BY table_name, ordinal_position",
    );
    const counts = await db.query(
      'SELECT (SELECT count(*)::int FROM "Customer") AS customers, (SELECT count(*)::int FROM "CustomerRecord") AS purchases, (SELECT count(*)::int FROM "Prescription") AS prescriptions, (SELECT count(*)::int FROM "FrameCatalog") AS frames, (SELECT count(*)::int FROM "LensCatalog") AS lenses, (SELECT count(*)::int FROM "Order") AS orders, (SELECT count(*)::int FROM "admins") AS accounts',
    );
    console.log(
      JSON.stringify(
        { migrations: migrations.rows, accountColumns: columns.rows, records: counts.rows[0] },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
  const { prisma } = await import("../../src/config/database.js");
  try {
    await prisma.admin.findFirst({
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
    console.log("Prisma account read: OK");
  } catch (error: unknown) {
    const failure = error as {
      code?: string;
      meta?: { modelName?: string; column?: string; table?: string };
    };
    console.log(
      JSON.stringify({
        prismaError: failure.code,
        model: failure.meta?.modelName,
        column: failure.meta?.column,
        table: failure.meta?.table,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Account schema inspection failed; connection details withheld.");
  process.exitCode = 1;
});
