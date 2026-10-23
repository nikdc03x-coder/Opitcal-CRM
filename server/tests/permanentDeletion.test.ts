import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { TEST_DATABASE_URL, mockPrismaMethod } from "./testUtils";
import { permanentlyDelete as clientPermanentDelete } from "../../client/src/services/customerApi";

const customerId = "10000000-0000-4000-8000-000000000001";
const purchaseId = "20000000-0000-4000-8000-000000000001";

async function pinSetup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const service = await import("../src/services/deletionPinService");
  let settings: { pinHash: string; failedAttempts: number; lockedUntil: Date | null } | null = null;
  mockPrismaMethod(t, prisma, "$queryRaw", async () => []);
  mockPrismaMethod(t, prisma.adminDeletionPin, "findUnique", async () => settings);
  mockPrismaMethod(
    t,
    prisma.adminDeletionPin,
    "upsert",
    async ({ create, update }: { create: { pinHash: string }; update: { pinHash: string } }) => {
      settings = {
        pinHash: settings ? update.pinHash : create.pinHash,
        failedAttempts: 0,
        lockedUntil: null,
      };
      return settings;
    },
  );
  mockPrismaMethod(
    t,
    prisma.adminDeletionPin,
    "update",
    async ({ data }: { data: Partial<NonNullable<typeof settings>> }) =>
      Object.assign(settings!, data),
  );
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback(prisma),
  );
  return { prisma, service, settings: () => settings };
}

test("PIN setup stores a salted hash, verifies initial PIN, and supports rotation", async (t) => {
  const { service, settings } = await pinSetup(t);
  await service.setDeletionPin(1, "9090");
  assert.notEqual(settings()!.pinHash, "9090");
  assert.match(settings()!.pinHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  await service.verifyDeletionPin(1, "9090");
  const previous = settings()!.pinHash;
  await service.setDeletionPin(1, "9090");
  assert.notEqual(settings()!.pinHash, previous, "Each setup uses a fresh salt");
  await service.setDeletionPin(1, "1234");
  await assert.rejects(service.verifyDeletionPin(1, "9090"), /Incorrect/);
  await service.verifyDeletionPin(1, "1234");
});

test("missing, malformed and unconfigured PINs fail closed", async (t) => {
  const { service } = await pinSetup(t);
  for (const pin of ["", "123", "12345", "abcd", "9a90"]) {
    await assert.rejects(service.verifyDeletionPin(1, pin), /four-digit/);
  }
  await assert.rejects(service.verifyDeletionPin(1, "9090"), /not been configured/);
});

test("failed PIN attempts commit, lock across requests, expire and reset on success", async (t) => {
  const { service, settings } = await pinSetup(t);
  await service.setDeletionPin(1, "9090");
  for (let i = 1; i <= 5; i++) {
    await assert.rejects(service.verifyDeletionPin(1, "1111"), i === 5 ? /locked/ : /Incorrect/);
    assert.equal(settings()!.failedAttempts, i);
  }
  await assert.rejects(service.verifyDeletionPin(1, "9090"), /locked/);
  settings()!.lockedUntil = new Date(Date.now() - 1);
  await service.verifyDeletionPin(1, "9090");
  assert.equal(settings()!.failedAttempts, 0);
  assert.equal(settings()!.lockedUntil, null);
});

async function deletionSetup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const service = await import("../src/services/permanentDeletionService");
  const state = {
    customerDeleted: true,
    purchaseDeleted: true,
    shared: false,
    historical: false,
    retained: false,
    notes: true,
    reference: false,
    referenceOnly: false,
    foreign: false,
    fail: false,
  };
  const writes: string[] = [];
  const sql: string[] = [];
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  mockPrismaMethod(
    t,
    prisma.customer,
    "findFirst",
    async ({ where }: { where: { id: string; shopId: string } }) => {
      assert.equal(where.shopId, "shop-1");
      return state.foreign
        ? null
        : { id: customerId, deletedAt: state.customerDeleted ? new Date() : null };
    },
  );
  mockPrismaMethod(
    t,
    prisma.customerRecord,
    "findMany",
    async ({ where }: { where: { customerId: string; id?: string } }) => {
      assert.equal(where.customerId, customerId);
      return [purchaseId, ...(where.id ? [] : ["second"])].map((id) => ({
        id,
        prescriptionId: "rx",
        deletedAt: state.purchaseDeleted ? new Date() : null,
      }));
    },
  );
  mockPrismaMethod(
    t,
    prisma.prescription,
    "findMany",
    async ({
      where,
    }: {
      where: {
        customerId: string;
        createdForPurchaseId?: string;
        records?: { none: { id: { not: string } } };
      };
    }) => {
      assert.equal(where.customerId, customerId);
      if (where.createdForPurchaseId) {
        assert.equal(where.createdForPurchaseId, purchaseId);
        assert.deepEqual(where.records, { none: { id: { not: purchaseId } } });
        if (state.shared || state.historical) return [];
      }
      return [{ id: "rx", deletedAt: new Date() }];
    },
  );
  mockPrismaMethod(t, prisma.order, "findMany", async () => [{ id: "order" }]);
  mockPrismaMethod(t, prisma.orderStatusHistory, "findMany", async () => [{ id: "history" }]);
  mockPrismaMethod(
    t,
    prisma,
    "$queryRaw",
    async (strings: { text?: string } | TemplateStringsArray) => {
      const text =
        "text" in strings ? strings.text! : Array.from(strings as TemplateStringsArray).join("?");
      sql.push(text);
      if (text.includes("to_regclass")) return [{ present: state.notes }];
      if (text.includes('SELECT id FROM "CustomerNoteVersion"')) return [{ id: "note" }];
      if (text.includes("pg_constraint"))
        return [
          {
            childSchema: "public",
            childTable: "LedgerEntry",
            childColumn: "recordId",
            parentTable: "CustomerRecord",
            parentColumn: "id",
            columns: 1,
          },
        ];
      if (text.includes("information_schema"))
        return state.reference ? [{ table: "RecordAudit", column: "entityId" }] : [];
      return [
        {
          found: state.retained && (!state.referenceOnly || text.includes('public."RecordAudit"')),
        },
      ];
    },
  );
  mockPrismaMethod(t, prisma, "$executeRaw", async () => {
    writes.push("notes");
    return 1;
  });
  for (const [model, name] of [
    [prisma.orderStatusHistory, "history"],
    [prisma.order, "orders"],
    [prisma.customerRecord, "purchases"],
    [prisma.prescription, "prescriptions"],
  ] as const) {
    mockPrismaMethod(t, model, "deleteMany", async () => {
      writes.push(name);
      if (state.fail && name === "purchases") throw new Error("Database failure");
      return { count: 1 };
    });
  }
  mockPrismaMethod(t, prisma.customer, "delete", async () => {
    writes.push("customer");
    return { id: customerId };
  });
  mockPrismaMethod(t, prisma.frameCatalog, "deleteMany", () =>
    assert.fail("Catalogs must never be deleted"),
  );
  mockPrismaMethod(t, prisma.lensCatalog, "deleteMany", () =>
    assert.fail("Catalogs must never be deleted"),
  );
  mockPrismaMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => unknown, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 });
      try {
        return await callback(prisma);
      } catch (error) {
        writes.length = 0;
        throw error;
      }
    },
  );
  return { prisma, service, state, writes, sql };
}

test("trashed customer removes owned purchases, prescriptions, notes and order history in dependency order", async (t) => {
  const { service, writes } = await deletionSetup(t);
  await service.permanentlyDeleteData(customerId);
  assert.deepEqual(writes, [
    "history",
    "orders",
    "purchases",
    "prescriptions",
    "notes",
    "customer",
  ]);
});

test("individual purchase removal preserves customer and notes and removes a proven exclusive prescription", async (t) => {
  const { service, writes } = await deletionSetup(t);
  const result = await service.permanentlyDeleteData(customerId, purchaseId);
  assert.equal(result.purchaseId, purchaseId);
  assert.deepEqual(writes, ["history", "orders", "purchases", "prescriptions"]);
});

for (const flag of ["shared", "historical"] as const)
  test(`purchase removal preserves ${flag} prescriptions including other trashed references`, async (t) => {
    const { service, state, writes } = await deletionSetup(t);
    state[flag] = true;
    await service.permanentlyDeleteData(customerId, purchaseId);
    assert.ok(!writes.includes("prescriptions"));
  });

test("active customers, active purchases and foreign customers are rejected", async (t) => {
  const { service, state, writes } = await deletionSetup(t);
  state.customerDeleted = false;
  await assert.rejects(service.permanentlyDeleteData(customerId), /already in Trash/);
  state.customerDeleted = true;
  state.purchaseDeleted = false;
  await assert.rejects(service.permanentlyDeleteData(customerId, purchaseId), /already in Trash/);
  state.foreign = true;
  await assert.rejects(service.permanentlyDeleteData(customerId), /not found/);
  assert.deepEqual(writes, []);
});

test("financial or audit references prevent any deletion, even if the FK would cascade", async (t) => {
  const { service, state, writes } = await deletionSetup(t);
  state.retained = true;
  await assert.rejects(service.permanentlyDeleteData(customerId), /retained financial/);
  assert.deepEqual(writes, []);
});

test("financial blocker identifies ledger history and preserves the deletion plan", async (t) => {
  const { service, state, writes } = await deletionSetup(t);
  state.retained = true;
  await assert.rejects(
    service.permanentlyDeleteData(customerId),
    /retained financial ledger references/,
  );
  assert.deepEqual(writes, []);
});

test("audit blocker identifies audit history after external foreign key checks pass", async (t) => {
  const { service, state, writes } = await deletionSetup(t);
  state.retained = true;
  state.reference = true;
  state.referenceOnly = true;
  await assert.rejects(
    service.permanentlyDeleteData(customerId),
    /retained audit history references/,
  );
  assert.deepEqual(writes, []);
});

test("transaction failure is propagated without a successful result or partial committed writes", async (t) => {
  const { service, state, writes } = await deletionSetup(t);
  state.fail = true;
  await assert.rejects(service.permanentlyDeleteData(customerId), /Database failure/);
  assert.deepEqual(writes, []);
});

test("client sends PIN only in the DELETE body and exposes failures", async (t) => {
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(String(url), `/api/customers/${customerId}/records/${purchaseId}/permanent`);
      assert.equal(options?.method, "DELETE");
      assert.deepEqual(JSON.parse(String(options?.body)), { pin: "9090" });
      return Response.json(
        { success: false, message: "Incorrect administrator PIN." },
        { status: 403 },
      );
    },
  );
  await assert.rejects(clientPermanentDelete(customerId, "9090", purchaseId), /Incorrect/);
  assert.equal(mock.mock.calls.length, 1);
});

test("production routes require administrator sessions and trusted origin before accepting a PIN", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.CLIENT_URL = "https://crm.example.test";
  const { default: app } = await import("../src/app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/customers`;
  for (const path of [
    `/${customerId}/permanent`,
    `/${customerId}/records/${purchaseId}/permanent`,
  ]) {
    assert.equal((await fetch(base + path, { method: "DELETE" })).status, 403);
    assert.equal(
      (
        await fetch(base + path, {
          method: "DELETE",
          headers: { Origin: "https://crm.example.test" },
        })
      ).status,
      401,
    );
  }
});

test("controller rejects missing PIN and URL PINs, locks wrong PINs, and never echoes the PIN", async (t) => {
  const { service } = await pinSetup(t);
  await service.setDeletionPin(1, "9090");
  const { permanentlyDelete } = await import("../src/controllers/permanentDeletionController");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  const app = express();
  app.use(express.json());
  app.delete(
    "/:id/permanent",
    (_req, res, next) => {
      res.locals.adminId = 1;
      res.locals.adminRole = "ADMIN";
      next();
    },
    permanentlyDelete,
  );
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${customerId}/permanent`;
  const send = (body: unknown, url = base) =>
    fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await send({})).status, 400);
  assert.equal((await send({ pin: "9090" }, `${base}?pin=9090`)).status, 400);
  for (let i = 1; i <= 5; i++) {
    const response = await send({ pin: "1111" });
    assert.equal(response.status, i === 5 ? 429 : 403);
    assert.equal((await response.text()).includes("1111"), false);
  }
  assert.equal((await send({ pin: "9090" })).status, 429);
});

test("permanent-deletion request limiter rejects excess requests with retry headers", async (t) => {
  const { deletionPinLimiter } = await import("../src/middleware/deletionPinLimiter");
  const app = express();
  app.delete("/permanent", deletionPinLimiter, (_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/permanent`;
  for (let i = 0; i < 20; i++) assert.equal((await fetch(url, { method: "DELETE" })).status, 204);
  const rejected = await fetch(url, { method: "DELETE" });
  assert.equal(rejected.status, 429);
  assert.ok(rejected.headers.get("retry-after"));
  assert.equal((await rejected.json()).success, false);
});
