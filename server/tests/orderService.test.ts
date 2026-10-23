import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { OrderInputError } from "../src/validators/orderValidator";
import { errorHandler } from "../src/middleware/errorHandler";

// Assign through Prisma's proxy instead of relying on its virtual descriptors.
function mockMethod(
  t: TestContext,
  object: object,
  method: string,
  implementation: (...args: never[]) => unknown,
) {
  const target = object as Record<string, unknown>;
  const original = target[method];
  const replacement = t.mock.fn(implementation);
  target[method] = replacement;
  t.after(() => {
    target[method] = original;
  });
  return replacement;
}

async function setup(t: TestContext) {
  process.env.DATABASE_URL =
    "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/test?sslmode=verify-full";
  const { prisma } = await import("../src/config/database");
  const service = await import("../src/services/orderService");
  mockMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  return { prisma, service };
}

test("creating an order records the initial history and rejects duplicate purchases", async (t) => {
  const { prisma, service } = await setup(t);
  mockMethod(t, prisma.customer, "findFirst", async () => ({ id: "customer-1" }));
  mockMethod(t, prisma.customerRecord, "findFirst", async () => ({ id: "purchase-1" }));
  let exists = false;
  const histories: unknown[] = [];
  const tx = {
    order: {
      findUnique: async () => (exists ? { id: "order-1" } : null),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        exists = true;
        assert.equal(data.shopId, "shop-1");
        assert.equal(data.status, "PLACED");
        assert.match(String(data.orderNumber), /^ORD-[A-F0-9]{12}$/);
        return { id: "order-1", ...data };
      },
    },
    orderStatusHistory: {
      create: async (entry: unknown) => {
        histories.push(entry);
      },
    },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  const input = {
    customerId: "customer-1",
    purchaseRecordId: "purchase-1",
    expectedDeliveryDate: null,
    internalNotes: null,
  };
  const order = await service.createOrder(input);
  assert.equal(order.id, "order-1");
  assert.deepEqual(histories, [
    {
      data: {
        orderId: "order-1",
        fromStatus: null,
        toStatus: "PLACED",
        note: "Order created manually.",
      },
    },
  ]);
  await assert.rejects(
    service.createOrder(input),
    (error: unknown) => error instanceof OrderInputError && error.statusCode === 409,
  );
  assert.equal(histories.length, 1);
});

test("order creation rejects a missing customer or a purchase owned by another customer", async (t) => {
  const { prisma, service } = await setup(t);
  const customer = mockMethod(t, prisma.customer, "findFirst", async () => null);
  mockMethod(t, prisma.customerRecord, "findFirst", async () => null);
  mockMethod(t, prisma, "$transaction", () => assert.fail("Invalid orders must never be saved"));
  const input = {
    customerId: "other-customer",
    purchaseRecordId: "other-purchase",
    expectedDeliveryDate: null,
    internalNotes: null,
  };
  await assert.rejects(
    service.createOrder(input),
    (error: unknown) => error instanceof OrderInputError && error.statusCode === 404,
  );
  customer.mock.mockImplementation(async () => ({ id: "other-customer" }));
  await assert.rejects(service.createOrder(input), /does not belong/);
});

test("search, status and pagination stay scoped to the shop and sort deterministically", async (t) => {
  const { prisma, service } = await setup(t);
  const find = mockMethod(t, prisma.order, "findMany", async () => [{ id: "matching-order" }]);
  const count = mockMethod(t, prisma.order, "count", async () => 25);
  const result = await service.listOrders("OVERDUE", 2, 20, "Customer on another page");
  assert.equal(result.totalPages, 2);
  assert.equal(result.orders[0].id, "matching-order");
  const query = find.mock.calls[0].arguments[0];
  assert.equal(query.where.shopId, "shop-1");
  assert.deepEqual(query.where.status, { in: ["PLACED", "PROCESSING", "READY"] });
  assert.ok(query.where.expectedDeliveryDate.lt instanceof Date);
  assert.equal(query.skip, 20);
  assert.equal(query.take, 20);
  assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.deepEqual(count.mock.calls[0].arguments[0].where, query.where);
  assert.equal(query.where.OR[1].customer.name.contains, "Customer on another page");
});

test("eligible purchases exclude already tracked purchases and inactive or foreign customers", async (t) => {
  const { prisma, service } = await setup(t);
  const find = mockMethod(t, prisma.customer, "findFirst", async () => ({
    id: "customer-1",
    records: [],
  }));
  assert.deepEqual(await service.getEligiblePurchases("customer-1"), {
    id: "customer-1",
    records: [],
  });
  const query = find.mock.calls[0].arguments[0];
  assert.deepEqual(query.where, {
    id: "customer-1",
    shopId: "shop-1",
    isActive: true,
    deletedAt: null,
  });
  assert.deepEqual(query.select.records.where, {
    deletionGroupId: null,
    deletedAt: null,
    order: { is: null },
  });
  assert.equal(query.select.prescriptions, undefined);
  find.mock.mockImplementation(async () => null);
  await assert.rejects(service.getEligiblePurchases("foreign-customer"), /Customer not found/);
});

test("status workflow records each transition and terminal delivery time", async (t) => {
  const { prisma, service } = await setup(t);
  let current = {
    id: "order-1",
    status: "PLACED",
    deliveredAt: null as Date | null,
    cancelledAt: null as Date | null,
  };
  const histories: { data: { fromStatus: string; toStatus: string } }[] = [];
  const tx = {
    order: {
      findFirst: async () => current,
      updateMany: async ({
        where,
        data,
      }: {
        where: { status: string };
        data: Partial<typeof current>;
      }) => {
        if (where.status !== current.status) return { count: 0 };
        current = { ...current, ...data };
        return { count: 1 };
      },
    },
    orderStatusHistory: {
      create: async (entry: (typeof histories)[number]) => {
        histories.push(entry);
      },
    },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  mockMethod(t, prisma.order, "findFirst", async () => current);
  await assert.rejects(
    service.updateOrderStatus("order-1", { status: "DELIVERED", note: null }),
    /Cannot move/,
  );
  for (const status of ["PROCESSING", "READY", "PROCESSING", "READY", "DELIVERED"] as const) {
    const previous = current.status;
    await service.updateOrderStatus("order-1", { status, note: null });
    assert.deepEqual(histories.at(-1)?.data, {
      orderId: "order-1",
      fromStatus: previous,
      toStatus: status,
      note: null,
    });
  }
  assert.ok(current.deliveredAt instanceof Date);
  assert.equal(current.cancelledAt, null);
  await assert.rejects(
    service.updateOrderStatus("order-1", { status: "PROCESSING", note: null }),
    /Cannot move/,
  );
  assert.equal(histories.length, 5);
});

test("stale and concurrent status changes never create a history entry", async (t) => {
  const { prisma, service } = await setup(t);
  const tx = {
    order: {
      findFirst: async () => ({ id: "order-1", status: "READY" }),
      updateMany: async () => ({ count: 0 }),
    },
    orderStatusHistory: { create: () => assert.fail("A conflict must not add history") },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  for (const expectedStatus of ["PROCESSING", "READY"] as const) {
    await assert.rejects(
      service.updateOrderStatus("order-1", { status: "DELIVERED", note: null, expectedStatus }),
      (error: unknown) => error instanceof OrderInputError && error.statusCode === 409,
    );
  }
});

test("cancelled orders stay closed and details cannot edit a closed or foreign order", async (t) => {
  const { prisma, service } = await setup(t);
  let current = { id: "order-1", status: "PLACED", cancelledAt: null as Date | null };
  const tx = {
    order: {
      findFirst: async () => current,
      updateMany: async ({ data }: { data: Partial<typeof current> }) => {
        current = { ...current, ...data };
        return { count: 1 };
      },
    },
    orderStatusHistory: { create: async () => ({}) },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  mockMethod(t, prisma.order, "findFirst", async () => current);
  await service.updateOrderStatus("order-1", { status: "CANCELLED", note: "Customer cancelled" });
  assert.ok(current.cancelledAt instanceof Date);
  await assert.rejects(
    service.updateOrderStatus("order-1", { status: "PROCESSING", note: null }),
    /Cannot move/,
  );
  const update = mockMethod(t, prisma.order, "updateMany", async () => ({ count: 0 }));
  await assert.rejects(
    service.updateOrderDetails("order-1", { internalNotes: "Changed" }),
    /already closed/,
  );
  assert.equal(update.mock.calls[0].arguments[0].where.shopId, "shop-1");
  assert.deepEqual(update.mock.calls[0].arguments[0].where.status.notIn, [
    "DELIVERED",
    "CANCELLED",
  ]);
});

test("summary includes empty statuses and counts active orders separately from closed orders", async (t) => {
  const { prisma, service } = await setup(t);
  mockMethod(t, prisma.order, "groupBy", async () => [
    { status: "PLACED", _count: { _all: 3 } },
    { status: "READY", _count: { _all: 2 } },
    { status: "DELIVERED", _count: { _all: 8 } },
  ]);
  const count = mockMethod(t, prisma.order, "count", async () => 1);
  assert.deepEqual(await service.getOrderSummary(), {
    placed: 3,
    processing: 0,
    ready: 2,
    delivered: 8,
    cancelled: 0,
    overdue: 1,
    active: 5,
  });
  assert.deepEqual(count.mock.calls[0].arguments[0].where.status.in, [
    "PLACED",
    "PROCESSING",
    "READY",
  ]);
});

test("removal deletes order history and the tracking order in every status while keeping the purchase", async (t) => {
  const { prisma, service } = await setup(t);
  const purchase = { id: "purchase-1", mrp: "500" };
  let current: { id: string; status: string } | null;
  let historyCount = 2;
  const tx = {
    order: {
      findFirst: async ({ where }: { where: { id: string; shopId: string } }) => {
        assert.deepEqual(where, {
          id: "order-1",
          shopId: "shop-1",
          customer: { isActive: true, deletedAt: null },
          purchase: { deletionGroupId: null, deletedAt: null },
        });
        return current;
      },
      deleteMany: async ({ where }: { where: { id: string; shopId: string } }) => {
        assert.deepEqual(where, { id: "order-1", shopId: "shop-1" });
        assert.equal(historyCount, 0, "History must be removed before deleting the parent order");
        current = null;
        return { count: 1 };
      },
    },
    orderStatusHistory: {
      deleteMany: async ({ where }: { where: { orderId: string } }) => {
        assert.deepEqual(where, { orderId: "order-1" });
        historyCount = 0;
        return { count: 2 };
      },
    },
  };
  mockMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => unknown, options: unknown) => {
      assert.deepEqual(options, { isolationLevel: "Serializable" });
      return callback(tx);
    },
  );
  mockMethod(t, prisma.customer, "deleteMany", () => assert.fail("Customer must be kept"));
  mockMethod(t, prisma.customerRecord, "deleteMany", () => assert.fail("Purchase must be kept"));
  mockMethod(t, prisma.customer, "findFirst", async () => ({
    id: "customer-1",
    records: current ? [] : [purchase],
  }));
  for (const status of ["PLACED", "PROCESSING", "READY", "DELIVERED", "CANCELLED"]) {
    current = { id: "order-1", status };
    historyCount = 2;
    assert.deepEqual(await service.deleteOrder("order-1"), { id: "order-1" });
    assert.equal(current, null);
    assert.equal(historyCount, 0);
    assert.deepEqual((await service.getEligiblePurchases("customer-1")).records, [purchase]);
  }
});

test("removal never deletes history for a missing or foreign order, and reports concurrent deletion", async (t) => {
  const { prisma, service } = await setup(t);
  const tx = {
    order: {
      findFirst: async () => null as { id: string } | null,
      deleteMany: async () => ({ count: 0 }),
    },
    orderStatusHistory: {
      deleteMany: async (): Promise<{ count: number }> =>
        assert.fail("Missing orders must not delete any history"),
    },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  await assert.rejects(
    service.deleteOrder("foreign-order"),
    (error: unknown) => error instanceof OrderInputError && error.statusCode === 404,
  );
  tx.order.findFirst = async () => ({ id: "order-1" });
  tx.orderStatusHistory.deleteMany = async () => ({ count: 0 });
  await assert.rejects(
    service.deleteOrder("order-1"),
    (error: unknown) => error instanceof OrderInputError && error.statusCode === 409,
  );
});

test("a history deletion failure stops removal before the parent order is deleted", async (t) => {
  const { prisma, service } = await setup(t);
  const tx = {
    order: {
      findFirst: async () => ({ id: "order-1" }),
      deleteMany: () => assert.fail("A failed transaction must not continue deleting"),
    },
    orderStatusHistory: {
      deleteMany: async () => {
        throw new Error("Database unavailable");
      },
    },
  };
  mockMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) => callback(tx));
  await assert.rejects(service.deleteOrder("order-1"), /Database unavailable/);
});

test("DELETE order endpoint returns the removed ID and actionable missing/conflict responses", async (t) => {
  const { prisma } = await setup(t);
  const { Prisma } = await import("../src/generated/prisma/client");
  const { default: routes } = await import("../src/routes/orderRoutes");
  let exists = true;
  const tx = {
    order: {
      findFirst: async () => (exists ? { id: "order-1" } : null),
      deleteMany: async () => {
        exists = false;
        return { count: 1 };
      },
    },
    orderStatusHistory: { deleteMany: async () => ({ count: 1 }) },
  };
  const transaction = mockMethod(
    t,
    prisma,
    "$transaction",
    async (callback: (tx: unknown) => unknown) => callback(tx),
  );
  const app = express();
  app.use("/orders", routes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/orders/order-1`;
  try {
    const removed = await fetch(url, { method: "DELETE" });
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { success: true, data: { id: "order-1" } });
    assert.equal((await fetch(url, { method: "DELETE" })).status, 404);
    for (const code of ["P2034", "P2003"]) {
      transaction.mock.mockImplementation(async () => {
        throw new Prisma.PrismaClientKnownRequestError("Concurrent write", {
          code,
          clientVersion: "test",
        });
      });
      const conflict = await fetch(url, { method: "DELETE" });
      assert.equal(conflict.status, 409);
      assert.match((await conflict.json()).message, /Refresh and try again/);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("order HTTP routes validate input and return useful conflict responses", async (t) => {
  const { prisma } = await setup(t);
  const { Prisma } = await import("../src/generated/prisma/client");
  const { default: routes } = await import("../src/routes/orderRoutes");
  mockMethod(t, prisma.customer, "findFirst", async () => ({ id: "customer-1" }));
  mockMethod(t, prisma.customerRecord, "findFirst", async () => ({ id: "purchase-1" }));
  mockMethod(t, prisma, "$transaction", async () => {
    throw new Prisma.PrismaClientKnownRequestError("Duplicate", {
      code: "P2002",
      clientVersion: "test",
    });
  });
  const app = express();
  app.use(express.json());
  app.use("/orders", routes);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/orders`;
  try {
    for (const query of [
      "?page=1&page=2",
      "?status=unknown",
      "?pageSize=101",
      "/eligible-purchases",
    ]) {
      assert.equal((await fetch(`${base}${query}`)).status, 400);
    }
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: "customer-1", purchaseRecordId: "purchase-1" }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /already exists/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
