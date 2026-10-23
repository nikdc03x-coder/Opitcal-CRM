import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import {
  deleteCustomer,
  deletePurchase,
  restoreDeleted,
} from "../../client/src/services/customerApi";

const customerId = "10000000-0000-4000-8000-000000000001";
const purchaseId = "20000000-0000-4000-8000-000000000001";
type Row = Record<string, unknown>;
type Query = { where: Row; data: Row };

async function setup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const service = await import("../src/services/deletionService");
  const state = {
    customer: [
      {
        id: customerId,
        shopId: "shop-1",
        isActive: true,
        deletionGroupId: null,
        deletedAt: null,
        name: "Customer",
        notes: "Private",
        reference: "Referral",
      },
    ] as Row[],
    customerRecord: [
      {
        id: purchaseId,
        customerId,
        prescriptionId: "rx",
        deletionGroupId: null,
        deletedAt: null,
        mrp: 100,
        specsType: "Frame",
        lensType: "Lens",
      },
      {
        id: "other",
        customerId,
        prescriptionId: "unrelated",
        deletionGroupId: null,
        deletedAt: null,
        mrp: 200,
      },
    ] as Row[],
    prescription: [
      {
        id: "rx",
        customerId,
        createdForPurchaseId: purchaseId,
        deletionGroupId: null,
        deletedAt: null,
      },
      {
        id: "unrelated",
        customerId,
        createdForPurchaseId: null,
        deletionGroupId: null,
        deletedAt: null,
      },
    ] as Row[],
  };
  function matches(row: Row, where: Row): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (key === "customer")
        return state.customer.some((c) => c.id === row.customerId && matches(c, value as Row));
      if (key === "records")
        return !state.customerRecord.some(
          (p) => p.prescriptionId === row.id && matches(p, (value as { none: Row }).none),
        );
      if (value && typeof value === "object" && "not" in value) return row[key] !== value.not;
      return row[key] === value;
    });
  }
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  for (const model of ["customer", "customerRecord", "prescription"] as const) {
    const rows = state[model];
    mockPrismaMethod(
      t,
      prisma[model],
      "findFirst",
      async ({ where }: Query) => rows.find((row) => matches(row, where)) ?? null,
    );
    mockPrismaMethod(t, prisma[model], "findMany", async ({ where }: Query) =>
      rows.filter((row) => matches(row, where)),
    );
    mockPrismaMethod(t, prisma[model], "update", async ({ where, data }: Query) => {
      const row = rows.find((row) => matches(row, where));
      assert.ok(row);
      Object.assign(row, data);
      return row;
    });
    mockPrismaMethod(t, prisma[model], "updateMany", async ({ where, data }: Query) => {
      const selected = rows.filter((row) => matches(row, where));
      selected.forEach((row) => Object.assign(row, data));
      return { count: selected.length };
    });
    mockPrismaMethod(t, prisma[model], "deleteMany", () =>
      assert.fail("Deletion must be recoverable"),
    );
  }
  mockPrismaMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => Promise<unknown>, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 });
      const before = structuredClone(state);
      try {
        return await callback(prisma);
      } catch (error) {
        for (const model of ["customer", "customerRecord", "prescription"] as const)
          state[model].splice(0, state[model].length, ...before[model]);
        throw error;
      }
    },
  );
  return { prisma, service, state };
}

test("customer cascade and restore preserve previously trashed purchases and unrelated data", async (t) => {
  const { service, state } = await setup(t);
  await service.deleteCustomerData(customerId, purchaseId);
  const oldGroup = state.customerRecord[0].deletionGroupId;
  await service.deleteCustomerData(customerId);
  assert.equal(state.customer[0].isActive, false);
  assert.ok(state.customerRecord.every((row) => row.deletionGroupId));
  assert.ok(state.prescription.every((row) => row.deletionGroupId));
  assert.equal(
    (await service.listTrash()).purchases.length,
    0,
    "Customer cascade has no duplicate purchase entries",
  );
  await assert.rejects(service.restoreCustomerData(customerId, purchaseId), /Restore the customer/);
  await service.restoreCustomerData(customerId);
  assert.equal(state.customer[0].isActive, true);
  assert.equal(state.customerRecord[0].deletionGroupId, oldGroup);
  assert.equal(state.prescription[0].deletionGroupId, oldGroup);
  assert.equal(state.customerRecord[1].deletionGroupId, null);
  assert.equal(state.prescription[1].deletionGroupId, null);
  assert.equal((await service.listTrash()).purchases.length, 1);
  await service.restoreCustomerData(customerId, purchaseId);
  assert.equal(state.customerRecord[0].deletionGroupId, null);
  assert.equal(state.prescription[0].deletionGroupId, null);
});

test("customer without purchases can be deleted and restored", async (t) => {
  const { service, state } = await setup(t);
  state.customerRecord.length = 0;
  state.prescription.length = 0;
  await service.deleteCustomerData(customerId);
  await service.restoreCustomerData(customerId);
  assert.equal(state.customer[0].isActive, true);
});

for (const [frame, lens] of [
  ["Frame", null],
  [null, "Lens"],
  ["Frame", "Lens"],
]) {
  test(`purchase deletion and restore: ${frame ?? "no frame"} / ${lens ?? "no lens"}`, async (t) => {
    const { service, state } = await setup(t);
    Object.assign(state.customerRecord[0], { specsType: frame, lensType: lens });
    const customerBefore = structuredClone(state.customer[0]);
    const otherPurchase = structuredClone(state.customerRecord[1]);
    const unrelatedRx = structuredClone(state.prescription[1]);
    const result = await service.deleteCustomerData(customerId, purchaseId);
    assert.equal(result.prescriptionId, "rx");
    assert.ok(state.prescription[0].deletionGroupId);
    assert.deepEqual(state.customer[0], customerBefore);
    assert.deepEqual(state.customerRecord[1], otherPurchase);
    assert.deepEqual(state.prescription[1], unrelatedRx);
    const revenue = () =>
      state.customerRecord
        .filter((row) => row.deletionGroupId === null)
        .reduce((sum, row) => sum + Number(row.mrp), 0);
    assert.equal(revenue(), 200);
    await assert.rejects(service.deleteCustomerData(customerId, purchaseId), /Purchase not found/);
    await service.restoreCustomerData(customerId, purchaseId);
    assert.equal(revenue(), 300);
    await assert.rejects(service.restoreCustomerData(customerId, purchaseId), /Purchase not found/);
  });
}

for (const mode of ["none", "historical", "older", "shared", "foreign"] as const) {
  test(`safe prescription policy preserves ${mode} prescription`, async (t) => {
    const { service, state } = await setup(t);
    if (mode === "none") state.customerRecord[0].prescriptionId = null;
    if (mode === "historical") state.prescription[0].createdForPurchaseId = null;
    if (mode === "older") state.prescription[0].createdForPurchaseId = "older-purchase";
    if (mode === "shared") state.customerRecord[1].prescriptionId = "rx";
    if (mode === "foreign") state.prescription[0].customerId = "foreign";
    const before = structuredClone(state.prescription);
    const result = await service.deleteCustomerData(customerId, purchaseId);
    assert.equal(result.prescriptionId, null);
    assert.deepEqual(state.prescription, before);
  });
}

test("restoring an earlier shared purchase restores its prescription dependency only", async (t) => {
  const { service, state } = await setup(t);
  state.customerRecord[1].prescriptionId = "rx";
  await service.deleteCustomerData(customerId, "other");
  await service.deleteCustomerData(customerId, purchaseId);
  assert.ok(state.prescription[0].deletionGroupId);
  await service.restoreCustomerData(customerId, "other");
  assert.equal(state.prescription[0].deletionGroupId, null);
  assert.ok(state.customerRecord[0].deletionGroupId);
});

test("missing/foreign customers and purchase ownership are checked without changes", async (t) => {
  const { service, state } = await setup(t);
  const before = structuredClone(state);
  await assert.rejects(service.deleteCustomerData("missing"), /Customer not found/);
  state.customer[0].shopId = "foreign";
  await assert.rejects(service.deleteCustomerData(customerId), /Customer not found/);
  state.customer[0].shopId = "shop-1";
  state.customerRecord[0].customerId = "other-customer";
  await assert.rejects(service.deleteCustomerData(customerId, purchaseId), /Purchase not found/);
  state.customerRecord[0].customerId = customerId;
  assert.deepEqual(state, before);
});

test("database failure aborts customer cascade and never returns success", async (t) => {
  const { prisma, service, state } = await setup(t);
  const before = structuredClone(state);
  mockPrismaMethod(t, prisma.prescription, "updateMany", () => {
    throw new Error("Database failure");
  });
  await assert.rejects(service.deleteCustomerData(customerId), /Database failure/);
  assert.deepEqual(state, before);
});

test("restore failure leaves the complete deletion group in Trash", async (t) => {
  const { prisma, service, state } = await setup(t);
  await service.deleteCustomerData(customerId);
  const before = structuredClone(state);
  mockPrismaMethod(t, prisma.prescription, "updateMany", () => {
    throw new Error("Restore failed");
  });
  await assert.rejects(service.restoreCustomerData(customerId), /Restore failed/);
  assert.deepEqual(state, before);
});

test("legacy Trash timestamps are preserved and missing restore provenance fails safely", async (t) => {
  const { service, state } = await setup(t);
  state.customerRecord[0].deletedAt = new Date();
  await assert.rejects(
    service.restoreCustomerData(customerId, purchaseId),
    /original Trash workflow/,
  );
  const before = structuredClone(state.customerRecord[0]);
  await service.deleteCustomerData(customerId);
  await service.restoreCustomerData(customerId);
  assert.deepEqual(
    state.customerRecord[0],
    before,
    "Customer restore must not resurrect older Trash data",
  );
});

test("delete/restore HTTP responses validate IDs, ownership and database failures", async (t) => {
  const { prisma } = await setup(t);
  const { default: router } = await import("../src/routes/customerRoutes");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  const app = express();
  app.use("/customers", router);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/customers`;
  assert.equal((await fetch(`${base}/bad`, { method: "DELETE" })).status, 400);
  assert.equal(
    (
      await fetch(`${base}/${customerId}/records/30000000-0000-4000-8000-000000000001`, {
        method: "DELETE",
      })
    ).status,
    404,
  );
  const deleted = await fetch(`${base}/${customerId}/records/${purchaseId}`, { method: "DELETE" });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).data.purchaseId, purchaseId);
  assert.equal(
    (await fetch(`${base}/${customerId}/records/${purchaseId}/restore`, { method: "POST" })).status,
    200,
  );
  mockPrismaMethod(t, prisma, "$transaction", () => {
    throw Object.assign(new Error("Failure"), { code: "P1001" });
  });
  const failed = await fetch(`${base}/${customerId}`, { method: "DELETE" });
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).success, false);
});

test("client deduplicates delete requests and exposes backend and network failures", async (t) => {
  let finish!: (response: Response) => void;
  const mock = t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  const first = deletePurchase(customerId, purchaseId);
  const second = deletePurchase(customerId, purchaseId);
  assert.equal(first, second);
  assert.equal(mock.mock.calls.length, 1);
  finish(
    new Response(JSON.stringify({ success: false, message: "Permission denied" }), { status: 403 }),
  );
  await assert.rejects(first, /Permission denied/);
  mock.mock.mockImplementation(async () => {
    throw new TypeError("Network failure");
  });
  await assert.rejects(deleteCustomer(customerId), /Network failure/);
  mock.mock.mockImplementation(
    async () => new Response(JSON.stringify({ success: true, data: { customerId } })),
  );
  await deleteCustomer(customerId);
  await restoreDeleted(customerId);
});
