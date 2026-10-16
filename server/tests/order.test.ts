import assert from "node:assert/strict";
import test from "node:test";
import {
  OrderInputError,
  validateCreateOrder,
  validateOrderStatus,
  validateUpdateOrder,
  validateOrderQuery,
} from "../src/validators/orderValidator";
import { shopToday } from "../src/utils/date";

const customerId = "10000000-0000-4000-8000-000000000001";
const purchaseRecordId = "20000000-0000-4000-8000-000000000001";

test("orders can be created with optional notes and delivery date omitted", () => {
  assert.deepEqual(validateCreateOrder({ customerId, purchaseRecordId }), {
    customerId,
    purchaseRecordId,
    expectedDeliveryDate: null,
    internalNotes: null,
  });
});

test("status updates accept an omitted optional note", () => {
  assert.deepEqual(validateOrderStatus({ status: "PROCESSING" }), {
    status: "PROCESSING",
    note: null,
  });
});

test("delivery dates reject nonexistent dates and support clearing", () => {
  assert.throws(() => validateUpdateOrder({ expectedDeliveryDate: "2026-02-29" }), OrderInputError);
  assert.deepEqual(validateUpdateOrder({ expectedDeliveryDate: null }), {
    expectedDeliveryDate: null,
  });
  assert.deepEqual(validateUpdateOrder({ expectedDeliveryDate: "2024-02-29" }), {
    expectedDeliveryDate: new Date("2024-02-29T00:00:00.000Z"),
  });
});

test("order input rejects invalid bodies, status values, notes and empty updates", () => {
  for (const body of [undefined, null, [], "order"]) {
    assert.throws(() => validateCreateOrder(body), OrderInputError);
  }
  for (const internalNotes of [123, {}, [], "x".repeat(2001)]) {
    assert.throws(
      () => validateCreateOrder({ customerId, purchaseRecordId, internalNotes }),
      OrderInputError,
    );
  }
  for (const status of ["ALL", "ACTIVE", "OVERDUE", "ready", null]) {
    assert.throws(() => validateOrderStatus({ status }), OrderInputError);
  }
  assert.throws(
    () => validateOrderStatus({ status: "READY", expectedStatus: "ALL" }),
    OrderInputError,
  );
  assert.throws(() => validateUpdateOrder({}), OrderInputError);
  assert.deepEqual(validateUpdateOrder({ internalNotes: "  staff only  " }), {
    internalNotes: "staff only",
  });
});

test("order query validates scalar pagination, filters and search", () => {
  assert.deepEqual(validateOrderQuery({}), {
    status: undefined,
    page: 1,
    pageSize: 20,
    search: "",
  });
  for (const status of ["ACTIVE", "OVERDUE", "READY"]) {
    assert.equal(
      validateOrderQuery({ status, search: "  Customer  ", page: "2", pageSize: "10" }).search,
      "Customer",
    );
  }
  for (const query of [
    { page: ["1"] },
    { page: "1.5" },
    { page: "0" },
    { page: "100001" },
    { pageSize: "101" },
    { pageSize: "" },
    { status: ["READY"] },
    { status: "bad" },
    { search: ["name"] },
    { search: "x".repeat(201) },
  ])
    assert.throws(() => validateOrderQuery(query), OrderInputError);
});

test("overdue dates change at midnight in India, independently of the server timezone", () => {
  assert.equal(
    shopToday(new Date("2026-10-15T18:29:59Z")).toISOString(),
    "2026-10-15T00:00:00.000Z",
  );
  assert.equal(
    shopToday(new Date("2026-10-15T18:30:00Z")).toISOString(),
    "2026-10-16T00:00:00.000Z",
  );
  assert.equal(
    shopToday(new Date("2026-12-31T18:30:00Z")).toISOString(),
    "2027-01-01T00:00:00.000Z",
  );
});
