import assert from "node:assert/strict";
import test from "node:test";

test("order client sends global search and active/overdue filters with pagination and cancellation", async (t) => {
  const { fetchOrders } = await import("../../client/src/services/orderApi");
  const response = { orders: [], total: 0, page: 2, pageSize: 20, totalPages: 0 };
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: response }),
  );
  const controller = new AbortController();
  for (const status of ["ACTIVE", "OVERDUE"] as const) {
    assert.deepEqual(await fetchOrders(status, 2, controller.signal, "  Name & Lens  "), response);
    const [path, options] = request.mock.calls.at(-1)!.arguments as unknown as [
      string,
      RequestInit,
    ];
    const url = new URL(path, "http://localhost");
    assert.equal(url.searchParams.get("status"), status);
    assert.equal(url.searchParams.get("page"), "2");
    assert.equal(url.searchParams.get("search"), "Name & Lens");
    assert.equal(options.signal, controller.signal);
    assert.equal(options.credentials, "include");
  }
});

test("order client loads eligible purchases and preserves the expected status on updates", async (t) => {
  const { fetchEligiblePurchases, updateTrackingOrderStatus } =
    await import("../../client/src/services/orderApi");
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: { id: "order-1" } }),
  );
  await fetchEligiblePurchases("customer & 1");
  assert.equal(
    new URL(String(request.mock.calls[0].arguments[0]), "http://localhost").searchParams.get(
      "customerId",
    ),
    "customer & 1",
  );
  await updateTrackingOrderStatus("order/1", {
    status: "READY",
    expectedStatus: "PROCESSING",
    note: null,
  });
  const [path, options] = request.mock.calls[1].arguments as unknown as [string, RequestInit];
  assert.equal(path, "/api/orders/order%2F1/status");
  assert.equal(options.method, "PATCH");
  assert.deepEqual(JSON.parse(String(options.body)), {
    status: "READY",
    expectedStatus: "PROCESSING",
    note: null,
  });
});

test("order client reports validation/conflict errors and handles non-JSON server failures", async (t) => {
  const { createTrackingOrder } = await import("../../client/src/services/orderApi");
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: false, message: "An order already exists." }, { status: 409 }),
  );
  const payload = {
    customerId: "customer-1",
    purchaseRecordId: "purchase-1",
    expectedDeliveryDate: null,
    internalNotes: null,
  };
  await assert.rejects(createTrackingOrder(payload), /An order already exists/);
  request.mock.mockImplementation(async () => new Response("Unavailable", { status: 503 }));
  await assert.rejects(createTrackingOrder(payload), /Order request failed \(503\)/);
});

test("order client removes an encoded order ID using the authenticated DELETE endpoint", async (t) => {
  const { removeTrackingOrder } = await import("../../client/src/services/orderApi");
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: { id: "order/1" } }),
  );
  assert.deepEqual(await removeTrackingOrder("order/1"), { id: "order/1" });
  const [path, options] = request.mock.calls[0].arguments as unknown as [string, RequestInit];
  assert.equal(path, "/api/orders/order%2F1");
  assert.equal(options.method, "DELETE");
  assert.equal(options.credentials, "include");
  request.mock.mockImplementation(async () =>
    Response.json({ success: false, message: "Order not found." }, { status: 404 }),
  );
  await assert.rejects(removeTrackingOrder("order/1"), /Order not found/);
});
