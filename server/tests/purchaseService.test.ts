import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import { createPurchaseRecordSchema } from "../src/validators/historyValidator";
import { HttpError } from "../src/utils/errors";

const customerId = "10000000-0000-4000-8000-000000000001";
const prescriptionId = "20000000-0000-4000-8000-000000000001";
const purchaseId = "30000000-0000-4000-8000-000000000001";
const input = {
  purchaseDate: "2026-10-22",
  prescriptionId,
  record: {
    pricingMode: "SPLIT" as const,
    specsType: "Frame",
    lensType: "Lens",
    frameRate: 0.1,
    lensRate: 0.2,
  },
};

async function setup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const service = await import("../src/services/customerHistoryService");
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  const customer = mockPrismaMethod(t, prisma.customer, "findFirst", async (query: unknown) => {
    assert.deepEqual(query, {
      where: { id: customerId, shopId: "shop-1", isActive: true, deletedAt: null },
      select: { id: true, shopId: true },
    });
    return { id: customerId, shopId: "shop-1" };
  });
  mockPrismaMethod(t, prisma.customer, "create", () =>
    assert.fail("Adding a purchase must never create a customer"),
  );
  mockPrismaMethod(t, prisma.customerRecord, "update", () =>
    assert.fail("Historical purchases must remain unchanged"),
  );
  return { prisma, service, customer };
}

test("new purchase validates supported products, pricing, dates and prescription choices", () => {
  assert.equal(createPurchaseRecordSchema.safeParse(input).success, true);
  const total = { pricingMode: "MRP_ONLY", specsType: "Frame", mrp: 100 };
  for (const record of [
    { ...total, specsType: null },
    { ...total, mrp: 0 },
    { ...total, mrp: -1 },
    { ...total, mrp: 1.234 },
    { ...total, mrp: Infinity },
    { ...total, mrp: 10000000000 },
    { ...input.record, lensType: null },
    { ...input.record, frameRate: 9999999999.99, lensRate: 1 },
  ])
    assert.equal(
      createPurchaseRecordSchema.safeParse({ record }).success,
      false,
      JSON.stringify(record),
    );
  for (const purchaseDate of ["2026-02-29", "2026-13-01", "2026-1-01"]) {
    assert.equal(createPurchaseRecordSchema.safeParse({ ...input, purchaseDate }).success, false);
  }
  for (const record of [
    total,
    { ...total, specsType: null, lensType: "Lens" },
    { ...input.record, lensType: null, lensRate: 0 },
    { ...input.record, specsType: null, frameRate: 0 },
  ])
    assert.equal(createPurchaseRecordSchema.safeParse({ record }).success, true);
  for (const prescription of [
    {},
    { re_dist: { sph: null } },
    { re_dist: { axis: 181 } },
    { le_near: { cyl: -16 } },
  ]) {
    assert.equal(
      createPurchaseRecordSchema.safeParse({ record: total, prescription }).success,
      false,
    );
  }
  assert.equal(
    createPurchaseRecordSchema.safeParse({ ...input, prescription: { re_dist: { sph: 0 } } })
      .success,
    false,
  );
  assert.equal(
    createPurchaseRecordSchema.safeParse({
      record: total,
      prescription: { re_dist: { sph: 0, axis: 0 } },
    }).success,
    true,
  );
  assert.equal(
    createPurchaseRecordSchema.safeParse({ ...input, customerId: "different" }).success,
    false,
  );
});

test("new purchase belongs to the selected active shop customer and exact linked prescription", async (t) => {
  const { prisma, service } = await setup(t);
  let writes = 0;
  const tx = {
    prescription: {
      findFirst: async (query: unknown) => {
        assert.deepEqual(query, {
          where: { id: prescriptionId, customerId, deletionGroupId: null, deletedAt: null },
          select: { id: true },
        });
        return { id: prescriptionId };
      },
      create: () => assert.fail("An existing prescription must not be copied"),
    },
    customerRecord: {
      create: async ({ data, include }: { data: Record<string, unknown>; include: unknown }) => {
        writes++;
        assert.deepEqual(include, { prescription: true });
        assert.equal(data.customerId, customerId);
        assert.equal(data.prescriptionId, prescriptionId);
        assert.equal(data.mrp, 0.3);
        assert.equal((data.purchaseDate as Date).toISOString(), "2026-10-22T00:00:00.000Z");
        return { id: purchaseId, ...data };
      },
    },
  };
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({ customer: prisma.customer, ...tx }),
  );
  const result = await service.addCustomerPurchase(customerId, input);
  assert.match(result?.id ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(writes, 1);
});

test("missing customers and foreign prescriptions are rejected before saving a purchase", async (t) => {
  const { prisma, service, customer } = await setup(t);
  const transaction = mockPrismaMethod(t, prisma, "$transaction", () =>
    assert.fail("Missing customers cannot start a write"),
  );
  customer.mock.mockImplementation(async () => null);
  assert.equal(await service.addCustomerPurchase(customerId, input), null);
  customer.mock.mockImplementation(async () => ({ id: customerId, shopId: "shop-1" }));
  const tx = {
    prescription: { findFirst: async () => null },
    customerRecord: { create: () => assert.fail("Foreign prescriptions must never be linked") },
  };
  transaction.mock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback({ customer: prisma.customer, ...tx }),
  );
  await assert.rejects(
    service.addCustomerPurchase(customerId, input),
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 400 && /this customer/.test(error.message),
  );
});

test("a new prescription and purchase use the same transaction and customer; unlinked purchases stay unlinked", async (t) => {
  const { prisma, service } = await setup(t);
  const created: Record<string, unknown>[] = [];
  let rxWrites = 0;
  const tx = {
    prescription: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rxWrites++;
        assert.equal(data.customerId, customerId);
        assert.equal(data.reDistSph, 0);
        assert.equal(data.leNearAxis, 90);
        return { id: prescriptionId };
      },
      findFirst: () => assert.fail("New or unlinked prescriptions must not fall back to latest"),
    },
    customerRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: purchaseId, ...data };
      },
    },
  };
  const transaction = mockPrismaMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => unknown) => callback({ customer: prisma.customer, ...tx }),
  );
  await service.addCustomerPurchase(customerId, {
    ...input,
    prescriptionId: null,
    prescription: { re_dist: { sph: 0 }, le_near: { axis: 90 } },
  });
  await service.addCustomerPurchase(customerId, {
    ...input,
    prescriptionId: null,
    purchaseDate: null,
  });
  assert.equal(transaction.mock.calls.length, 2);
  assert.equal(rxWrites, 1);
  assert.equal(created[0].prescriptionId, prescriptionId);
  assert.match(String(created[0].id), /^[0-9a-f-]{36}$/);
  assert.equal(created[1].prescriptionId, null);
  assert.equal(created[1].purchaseDate, null);
});

test("invalid catalog selections fail before creating the new prescription or purchase", async (t) => {
  const { prisma, service } = await setup(t);
  const tx = {
    frameCatalog: { findFirst: async () => null },
    prescription: { create: () => assert.fail("Do not save prescriptions for invalid purchases") },
    customerRecord: { create: () => assert.fail("Do not save invalid purchases") },
  };
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({ customer: prisma.customer, ...tx }),
  );
  await assert.rejects(
    service.addCustomerPurchase(customerId, {
      ...input,
      prescriptionId: null,
      prescription: { re_dist: { sph: 1 } },
      record: { ...input.record, frameCatalogId: "inactive-frame" },
    }),
    /unavailable or inactive/,
  );
});

test("new prescription and purchase failures reject the save without returning a success record", async (t) => {
  const { prisma, service } = await setup(t);
  let rxFails = true;
  let purchaseWrites = 0;
  const tx = {
    prescription: {
      create: async () => {
        if (rxFails) throw new Error("Prescription write failed");
        return { id: prescriptionId };
      },
    },
    customerRecord: {
      create: async () => {
        purchaseWrites++;
        throw new Error("Purchase write failed");
      },
    },
  };
  const transaction = mockPrismaMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => unknown) => callback({ customer: prisma.customer, ...tx }),
  );
  const payload = { ...input, prescriptionId: null, prescription: { re_dist: { sph: -1.25 } } };
  await assert.rejects(
    service.addCustomerPurchase(customerId, payload),
    /Prescription write failed/,
  );
  assert.equal(purchaseWrites, 0);
  rxFails = false;
  await assert.rejects(service.addCustomerPurchase(customerId, payload), /Purchase write failed/);
  assert.equal(transaction.mock.calls.length, 2);
  assert.equal(purchaseWrites, 1);
});

test("purchase HTTP route returns 201, validation errors, ownership errors and missing-customer errors", async (t) => {
  const { prisma, customer } = await setup(t);
  const { default: routes } = await import("../src/routes/customerRoutes");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  let owned = true;
  let writes = 0;
  const tx = {
    prescription: { findFirst: async () => (owned ? { id: prescriptionId } : null) },
    customerRecord: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes++;
        return { id: purchaseId, ...data };
      },
    },
  };
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({ customer: prisma.customer, ...tx }),
  );
  const app = express();
  app.use(express.json());
  app.use("/api/customers", routes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/customers/${customerId}/records`;
  const post = (body: unknown, target = url) =>
    fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const saved = await post(input);
    assert.equal(saved.status, 201);
    const body = await saved.json();
    assert.equal(body.data.customerId, customerId);
    assert.equal(body.data.prescriptionId, prescriptionId);
    assert.equal(writes, 1);
    assert.equal((await post({ ...input, purchaseDate: "2026-02-29" })).status, 400);
    assert.equal((await post(input, url.replace(customerId, "invalid"))).status, 400);
    owned = false;
    const foreign = await post(input);
    assert.equal(foreign.status, 400);
    assert.match((await foreign.json()).message, /this customer/);
    customer.mock.mockImplementation(async () => null);
    assert.equal((await post(input)).status, 404);
    assert.equal(writes, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("realistic HTTP purchase payloads return their linked prescription and reload through customer details", async (t) => {
  const { prisma, customer } = await setup(t);
  const { default: routes } = await import("../src/routes/customerRoutes");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  const prescriptions: Record<string, unknown>[] = [
    { id: prescriptionId, customerId, reDistSph: -1.25 },
  ];
  const records: Record<string, unknown>[] = [
    { id: "historic-purchase", customerId, prescriptionId, mrp: 100 },
  ];
  customer.mock.mockImplementation(async () => ({
    id: customerId,
    shopId: "shop-1",
    records,
    prescriptions,
  }));
  let next = 0;
  const tx = {
    prescription: {
      findFirst: async () => ({ id: prescriptionId }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const rx = { id: "40000000-0000-4000-8000-000000000001", ...data };
        prescriptions.push(rx);
        return rx;
      },
    },
    customerRecord: {
      create: async ({ data, include }: { data: Record<string, unknown>; include: unknown }) => {
        assert.deepEqual(include, { prescription: true });
        const record = { id: `new-purchase-${++next}`, ...data };
        records.push(record);
        return {
          ...record,
          prescription: prescriptions.find((rx) => rx.id === data.prescriptionId) ?? null,
        };
      },
    },
  };
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({ customer: prisma.customer, ...tx }),
  );
  const app = express();
  app.use(express.json());
  app.use("/api/customers", routes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/customers/${customerId}`;
  const post = (body: unknown) =>
    fetch(`${base}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const existing = await post({
      purchaseDate: "2026-10-22",
      prescriptionId,
      record: {
        pricingMode: "SPLIT",
        specsType: "Custom frame",
        lensType: null,
        frameRate: 500.1,
        lensRate: 0,
      },
    });
    assert.equal(existing.status, 201);
    assert.equal((await existing.json()).data.prescription.id, prescriptionId);
    assert.equal(prescriptions.length, 1);
    const fresh = await post({
      purchaseDate: "2026-10-22",
      prescription: { re_dist: { sph: 0, cyl: -0.75, axis: 90 }, le_near: { sph: 1.25 } },
      record: { pricingMode: "MRP_ONLY", specsType: null, lensType: "Custom AR lens", mrp: 850.25 },
    });
    assert.equal(fresh.status, 201);
    const saved = (await fresh.json()).data;
    assert.equal(saved.prescriptionId, saved.prescription.id);
    assert.equal(saved.customerId, customerId);
    assert.equal(saved.prescription.customerId, customerId);
    assert.equal(saved.prescription.reDistSph, 0);
    assert.equal(saved.prescription.reDistCyl, -0.75);
    assert.equal(saved.prescription.leNearSph, 1.25);
    const unlinked = await post({
      record: {
        pricingMode: "SPLIT",
        specsType: "Frame",
        lensType: "Lens",
        frameRate: 0.1,
        lensRate: 0.2,
      },
    });
    assert.equal(unlinked.status, 201);
    const none = (await unlinked.json()).data;
    assert.equal(none.prescriptionId, null);
    assert.equal(none.prescription, null);
    assert.equal(none.mrp, 0.3);
    const reload = await fetch(base);
    assert.equal(reload.status, 200);
    const details = (await reload.json()).data;
    assert.equal(details.records.length, 4);
    assert.equal(details.prescriptions.length, 2);
    assert.equal(details.records[0].id, "historic-purchase");
    assert.equal(details.records[2].prescriptionId, saved.prescription.id);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
