import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { Client } from "pg";

// Destructive verification is restricted to synthetic fixtures on this expiring branch.
const host = "ep-still-thunder-b4z72t75.c-6.us-east-2.aws.neon.tech";
if (process.argv[2] !== host) throw new Error("Pass the isolated test branch hostname explicitly.");
const direct = new URL(process.env.DIRECT_URL ?? "");
direct.hostname = host;
process.env.DIRECT_URL = direct.toString();
const pooled = new URL(direct);
pooled.hostname = host.replace(".c-6.", "-pooler.c-6.");
process.env.DATABASE_URL = pooled.toString();

async function main() {
  const pg = new Client({ connectionString: direct.toString(), connectionTimeoutMillis: 15000 });
  await pg.connect();
  try {
    const { rows } = await pg.query(
      "SELECT to_regclass('public.\"AdminDeletionPin\"') IS NOT NULL AS present",
    );
    if (!rows[0].present) {
      await pg.query("BEGIN");
      await pg.query(
        readFileSync("prisma/migrations/20261022120000_admin_deletion_pin/migration.sql", "utf8"),
      );
      await pg.query("COMMIT");
    }
  } finally {
    await pg.end();
  }
  const { prisma } = await import("../../src/config/database.js");
  let server: Server | undefined;
  let sessionId: string | undefined;
  try {
    const { getShopId } = await import("../../src/services/shopService.js");
    const { setDeletionPin } = await import("../../src/services/deletionPinService.js");
    const { deleteCustomerData, restoreCustomerData, listTrash } =
      await import("../../src/services/deletionService.js");
    const { addCustomerPurchase } = await import("../../src/services/customerHistoryService.js");
    const { getCustomerById } = await import("../../src/services/customerService.js");
    const { hashSessionToken, SESSION_COOKIE } = await import("../../src/utils/sessionCookie.js");
    const app = require("../../src/app").default as import("express").Express;
    const token = randomBytes(32).toString("hex");
    const session = await prisma.adminSession.create({
      data: {
        adminId: 1,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    sessionId = session.id;
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/customers`;
    const headers = {
      Origin: process.env.CLIENT_URL || "http://localhost:5173",
      Cookie: `${SESSION_COOKIE}=${token}`,
      "Content-Type": "application/json",
    };
    const remove = (id: string, recordId?: string, pin = "9090") =>
      fetch(`${base}/${id}${recordId ? `/records/${recordId}` : ""}/permanent`, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ pin }),
      });
    await setDeletionPin(1, "9090");
    const shopId = await getShopId();
    const customer = await prisma.customer.create({
      data: {
        shopId,
        name: `Permanent deletion test ${randomUUID()}`,
        notes: "Keep on purchase deletion",
      },
    });
    assert.ok(customer.name.startsWith("Permanent deletion test "));
    const first = await addCustomerPurchase(customer.id, {
      record: { specsType: "Test frame", lensType: "Test lens", pricingMode: "MRP_ONLY", mrp: 123 },
      prescription: { re_dist: { sph: -1 } },
    });
    assert.ok(first?.prescriptionId);
    const second = await addCustomerPurchase(customer.id, {
      record: { specsType: "Test frame", pricingMode: "MRP_ONLY", mrp: 50 },
      prescriptionId: first.prescriptionId,
    });
    assert.ok(second);
    const order = await prisma.order.create({
      data: {
        shopId,
        customerId: customer.id,
        purchaseRecordId: first.id,
        orderNumber: `TEST-${randomUUID()}`,
      },
    });
    await prisma.orderStatusHistory.create({ data: { orderId: order.id, toStatus: "PLACED" } });
    assert.equal((await remove(customer.id)).status, 409, "Active customers cannot be purged");
    assert.equal(
      (await remove(customer.id, first.id)).status,
      409,
      "Active purchases cannot be purged",
    );
    await deleteCustomerData(customer.id, first.id);
    assert.equal((await remove(customer.id, first.id, "1111")).status, 403);
    const purchaseResult = await remove(customer.id, first.id);
    assert.equal(purchaseResult.status, 200, await purchaseResult.text());
    assert.equal(await prisma.customerRecord.findUnique({ where: { id: first.id } }), null);
    assert.ok(
      await prisma.prescription.findUnique({ where: { id: first.prescriptionId } }),
      "Shared prescription preserved",
    );
    assert.equal(await prisma.order.count({ where: { id: order.id } }), 0);
    assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: order.id } }), 0);
    assert.equal((await getCustomerById(customer.id))?.notes, "Keep on purchase deletion");
    await deleteCustomerData(customer.id, second.id);
    await restoreCustomerData(customer.id, second.id);
    assert.equal(
      (await getCustomerById(customer.id))?.records.length,
      1,
      "Restore remains operational",
    );
    await prisma.$executeRaw`INSERT INTO "CustomerNoteVersion" (id, "customerId", content) VALUES (${randomUUID()}, ${customer.id}, 'Synthetic note history')`;
    await deleteCustomerData(customer.id);
    const customerResult = await remove(customer.id);
    assert.equal(customerResult.status, 200, await customerResult.text());
    assert.equal(await prisma.customer.findUnique({ where: { id: customer.id } }), null);
    assert.equal(await prisma.customerRecord.count({ where: { customerId: customer.id } }), 0);
    assert.equal(await prisma.prescription.count({ where: { customerId: customer.id } }), 0);
    const notes = await prisma.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "CustomerNoteVersion" WHERE "customerId" = ${customer.id}`;
    assert.equal(Number(notes[0].count), 0);
    assert.ok(!(await listTrash()).customers.some((row) => row.id === customer.id));
    await assert.rejects(restoreCustomerData(customer.id), /not found/);

    console.log(
      "PASS: synthetic purchase/customer purges, shared prescription safety, notes/orders and restore.",
    );
    // A retained audit snapshot must block purge, with no partially deleted rows.
    const retained = await prisma.customer.create({
      data: { shopId, name: `Permanent deletion test retained ${randomUUID()}` },
    });
    await prisma.$executeRaw`INSERT INTO "RecordAudit" (id, "shopId", "customerId", "entityType", "entityId", "actorId", "actorName", reason, "after")
      VALUES (${randomUUID()}, ${shopId}, ${retained.id}, 'Customer', ${retained.id}, 1, 'Synthetic verifier', 'Retention test', '{}'::jsonb)`;
    await deleteCustomerData(retained.id);
    assert.equal((await remove(retained.id)).status, 409);
    assert.ok(await prisma.customer.findUnique({ where: { id: retained.id } }));

    for (let i = 0; i < 5; i++) await remove(retained.id, undefined, "1111");
    assert.equal(
      (await remove(retained.id)).status,
      429,
      "Account lock applies even to the correct PIN",
    );
    await setDeletionPin(1, "9090");
    console.log(
      "PASS: isolated PostgreSQL and authenticated HTTP permanent deletion, shared Rx, customer cascade, order/note relationships, retention guard, PIN failures/lockout, Trash and restore.",
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (sessionId) await prisma.adminSession.delete({ where: { id: sessionId } });
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")
      : "Verification failed.",
  );
  process.exitCode = 1;
});
