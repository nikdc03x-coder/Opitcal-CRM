import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

// Explicit temporary branch allowlist. Never run fixture mutations on production.
const host = "ep-still-thunder-b4z72t75.c-6.us-east-2.aws.neon.tech";
if (process.argv[2] !== host)
  throw new Error("Pass the isolated deletion test branch hostname explicitly.");
const connection = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "");
connection.hostname = host;
process.env.DIRECT_URL = connection.toString();
const pooled = new URL(connection);
pooled.hostname = host.replace(".c-6.", "-pooler.c-6.");
process.env.DATABASE_URL = pooled.toString();

async function main() {
  const pg = new Client({
    connectionString: connection.toString(),
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
  });
  await pg.connect();
  try {
    const existing = await pg.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'Customer' AND column_name = 'deletionGroupId'",
    );
    if (!existing.rowCount) {
      await pg.query("BEGIN");
      await pg.query(
        readFileSync("prisma/migrations/20261022100000_recoverable_deletion/migration.sql", "utf8"),
      );
      await pg.query("COMMIT");
    }
  } finally {
    await pg.end();
  }

  const { prisma } = await import("../../src/config/database.js");
  try {
    console.log("Migration verified on the temporary branch.");
    const { getShopId } = await import("../../src/services/shopService.js");
    const { deleteCustomerData, restoreCustomerData, listTrash } =
      await import("../../src/services/deletionService.js");
    const { getCustomerById, searchCustomers } =
      await import("../../src/services/customerService.js");
    const { addCustomerPurchase } = await import("../../src/services/customerHistoryService.js");
    const { getAnalyticsOverview } = await import("../../src/services/analyticsService.js");
    const { parseAnalyticsQuery } = await import("../../src/validators/analyticsValidator.js");
    const { getDashboardAnalytics } = await import("../../src/services/dashboardService.js");
    const shopId = await getShopId();
    const customer = await prisma.customer.create({
      data: {
        shopId,
        name: `Deletion verification ${randomUUID()}`,
        notes: "Preserve me",
        reference: "Test",
      },
    });
    console.log("Synthetic customer created.");
    const first = await addCustomerPurchase(customer.id, {
      record: {
        specsType: "Test frame",
        lensType: "Test lens",
        pricingMode: "MRP_ONLY",
        mrp: 123.45,
      },
      prescription: { re_dist: { sph: -1.25 } },
      purchaseDate: "2026-10-22",
    });
    assert.ok(first?.prescriptionId);
    const second = await addCustomerPurchase(customer.id, {
      record: { specsType: "Frame", lensType: null, pricingMode: "MRP_ONLY", mrp: 200 },
      prescriptionId: first.prescriptionId,
      purchaseDate: "2026-10-22",
    });
    assert.ok(second);
    const query = parseAnalyticsQuery({ period: "all" });
    const before = await getAnalyticsOverview(query);
    await deleteCustomerData(customer.id, first.id);
    assert.equal((await getCustomerById(customer.id))?.records.length, 1);
    assert.equal(
      (await getCustomerById(customer.id))?.prescriptions.length,
      1,
      "Shared Rx survives",
    );
    const afterPurchase = await getAnalyticsOverview(query);
    assert.equal(afterPurchase.summary.purchases, before.summary.purchases - 1);
    assert.ok(
      Math.abs(Number(before.summary.value) - Number(afterPurchase.summary.value) - 123.45) < 0.001,
    );
    await restoreCustomerData(customer.id, first.id);
    assert.equal((await getAnalyticsOverview(query)).summary.purchases, before.summary.purchases);
    await deleteCustomerData(customer.id, second.id);
    await deleteCustomerData(customer.id, first.id);
    assert.equal(
      (await getCustomerById(customer.id))?.prescriptions.length,
      0,
      "Exclusive Rx cascades when no active reference remains",
    );
    await restoreCustomerData(customer.id, second.id);
    assert.equal(
      (await getCustomerById(customer.id))?.prescriptions.length,
      1,
      "Restore repairs a shared dependency",
    );
    await deleteCustomerData(customer.id);
    assert.equal(await getCustomerById(customer.id), null);
    assert.equal((await searchCustomers(undefined, customer.name)).length, 0);
    const trash = await listTrash();
    assert.ok(trash.customers.some((row) => row.id === customer.id));
    assert.ok(!trash.purchases.some((row) => row.customerId === customer.id));
    await restoreCustomerData(customer.id);
    const restored = await getCustomerById(customer.id);
    assert.equal(restored?.records.length, 1, "Previously deleted first purchase stays in Trash");
    assert.equal(restored?.notes, "Preserve me");
    await restoreCustomerData(customer.id, first.id);
    const after = await getAnalyticsOverview(query);
    assert.equal(after.summary.purchases, before.summary.purchases);
    assert.equal(after.summary.value, before.summary.value);
    await getDashboardAnalytics();
    console.log(
      "PASS: isolated PostgreSQL migration, purchase/customer delete and restore, shared/exclusive prescriptions, search, Trash, notes and analytics.",
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  // Do not emit connection URLs or customer data on failure.
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
      : "Verification failed",
  );
  process.exitCode = 1;
});
