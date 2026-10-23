import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";

async function setup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const shop = await import("../src/services/shopService");
  shop.clearShopIdCache();
  t.after(shop.clearShopIdCache);
  return { prisma, shop };
}

test("concurrent and repeated shop lookups share one query, expire, and can be cleared", async (t) => {
  const { prisma, shop } = await setup(t);
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const query = mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  assert.deepEqual(await Promise.all([shop.getShopId(), shop.getShopId(), shop.getShopId()]), [
    "shop-1",
    "shop-1",
    "shop-1",
  ]);
  assert.equal(await shop.getShopId(), "shop-1");
  assert.equal(query.mock.calls.length, 1);
  now += 60001;
  await shop.getShopId();
  assert.equal(query.mock.calls.length, 2);
  shop.clearShopIdCache();
  await shop.getShopId();
  assert.equal(query.mock.calls.length, 3);
});

test("missing shops and failed lookups are never cached", async (t) => {
  const { prisma, shop } = await setup(t);
  let call = 0;
  const query = mockPrismaMethod(t, prisma.shop, "findUnique", async () => {
    call++;
    if (call === 1) return null;
    if (call === 2) throw new Error("Temporary connection failure");
    return { id: "shop-1" };
  });
  await assert.rejects(shop.getShopId(), /shop not found/);
  await assert.rejects(shop.getShopId(), /Temporary connection/);
  assert.equal(await shop.getShopId(), "shop-1");
  assert.equal(query.mock.calls.length, 3);
});

test("customer creation returns persisted transaction rows without re-reading their history", async (t) => {
  const { prisma } = await setup(t);
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  const writes: string[] = [];
  const tx = {
    customer: {
      create: async ({ data }: { data: object }) => {
        writes.push("customer");
        return { ...data, id: "customer-1", createdAt: new Date() };
      },
      findUniqueOrThrow: () => assert.fail("Saved rows must not be fetched again"),
    },
    prescription: {
      create: async ({ data }: { data: object }) => {
        writes.push("prescription");
        return { ...data, id: "rx-1" };
      },
    },
    customerRecord: {
      create: async ({ data }: { data: object }) => {
        writes.push("record");
        return { ...data, createdAt: new Date() };
      },
    },
  };
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (db: unknown) => unknown) =>
    callback(tx),
  );
  const { createCustomer } = await import("../src/services/customerService");
  const customer = await createCustomer({
    name: "Performance Test",
    mobNumber: null,
    gender: null,
    reference: null,
    notes: null,
    prescription: { re_dist: { sph: 0 } },
    record: { pricingMode: "MRP_ONLY", specsType: "Frame", mrp: 100 },
  });
  assert.deepEqual(writes, ["customer", "prescription", "record"]);
  assert.equal(customer.records.length, 1);
  assert.equal(customer.prescriptions.length, 1);
  assert.equal(customer.records[0].prescriptionId, "rx-1");
  assert.equal(customer.records[0].mrp, 100);
  assert.equal(customer.prescriptions[0].reDistSph, 0);
});

test("catalog updates return the persisted item with one scoped update and no follow-up SELECT", async (t) => {
  const { prisma } = await setup(t);
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  for (const model of ["frameCatalog", "lensCatalog"] as const) {
    mockPrismaMethod(t, prisma[model], "findFirst", () => assert.fail("No post-update lookup"));
    mockPrismaMethod(
      t,
      prisma[model],
      "updateManyAndReturn",
      async ({ where, data }: { where: object; data: object }) => {
        assert.deepEqual(where, { id: "item-1", shopId: "shop-1" });
        return [{ id: "item-1", ...data }];
      },
    );
  }
  const { updateFrame, updateLens } = await import("../src/services/catalogService");
  assert.deepEqual(await updateFrame("item-1", { isActive: false }), {
    id: "item-1",
    isActive: false,
  });
  assert.deepEqual(await updateLens("item-1", { isActive: true }), {
    id: "item-1",
    isActive: true,
  });
  mockPrismaMethod(t, prisma.frameCatalog, "updateManyAndReturn", async () => []);
  assert.equal(await updateFrame("item-1", { isActive: true }), null);
});
