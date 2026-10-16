import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../src/validators/customerWriteValidator";
import { CUSTOMER_AGE_ERROR, parseCustomerAge } from "../../client/src/utils/customerAge";
import {
  receiptHtml,
  prescriptionHtml,
  whatsappReceiptMessage,
} from "../../client/src/utils/customerDocuments";
import type {
  CustomerDetails,
  CustomerRecord,
  Prescription,
} from "../../client/src/models/customer";

const customerId = "10000000-0000-4000-8000-000000000001";
const originalDate = new Date("2026-01-10T12:00:00.000Z");
const record = { pricingMode: "SPLIT" as const, frameRate: 0.1, lensRate: 0.2 };
const createInput = { name: "Test Customer", mobNumber: "9876543210", gender: "Female", record };

// nik - Exercise the real services and controllers with an isolated store; never contact live Neon.
async function customerStore(t: TestContext, age: number | null = null) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  let stored: Record<string, unknown> = {
    id: customerId,
    shopId: "shop-1",
    name: "Test Customer",
    mobNumber: "9876543210",
    gender: "Female",
    reference: null,
    notes: null,
    isActive: true,
    ageAtRecording: age,
    ageRecordedAt: age === null ? null : originalDate,
    prescriptions: [],
    records: [{ id: "purchase-1", mrp: "0.30" }],
  };
  const writes: Record<string, unknown>[] = [];
  const purchases: Record<string, unknown>[] = [];
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback(prisma),
  );
  mockPrismaMethod(t, prisma.customer, "findFirst", async () => stored);
  mockPrismaMethod(t, prisma.customer, "findUniqueOrThrow", async () => stored);
  mockPrismaMethod(
    t,
    prisma.customer,
    "create",
    async ({ data }: { data: Record<string, unknown> }) => {
      writes.push(data);
      stored = { ...stored, ...data };
      return stored;
    },
  );
  mockPrismaMethod(
    t,
    prisma.customer,
    "update",
    async ({ data }: { data: Record<string, unknown> }) => {
      writes.push(data);
      // nik - Prisma ignores omitted values rather than clearing unrelated customer fields.
      stored = {
        ...stored,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
      };
      return stored;
    },
  );
  mockPrismaMethod(
    t,
    prisma.customerRecord,
    "create",
    async ({ data }: { data: Record<string, unknown> }) => {
      purchases.push(data);
      return data;
    },
  );
  mockPrismaMethod(t, prisma.customerRecord, "update", () =>
    assert.fail("Personal edits must not change purchases"),
  );
  mockPrismaMethod(t, prisma.prescription, "create", () =>
    assert.fail("Age must not create prescriptions"),
  );
  mockPrismaMethod(t, prisma.prescription, "update", () =>
    assert.fail("Age must not change prescriptions"),
  );
  return { prisma, writes, purchases, services: await import("../src/services/customerService") };
}

test("age validators accept omission, blanks, null, zero and 120", () => {
  for (const ageAtRecording of [undefined, "", "  ", null, 0, 120]) {
    const created = createCustomerSchema.parse({ ...createInput, ageAtRecording });
    const updated = updateCustomerSchema.parse({ ageAtRecording });
    const expected = typeof ageAtRecording === "string" ? null : ageAtRecording;
    assert.equal(created.ageAtRecording, expected);
    assert.equal(updated.ageAtRecording, expected);
  }
  assert.equal(
    Object.hasOwn(updateCustomerSchema.parse({ name: "Updated" }), "ageAtRecording"),
    false,
  );
});

test("both API validators reject invalid ages with a friendly message", () => {
  for (const ageAtRecording of [
    -1,
    121,
    25.5,
    NaN,
    Infinity,
    "25",
    "25.5",
    "invalid",
    true,
    [],
    {},
  ]) {
    for (const schema of [createCustomerSchema, updateCustomerSchema]) {
      const result = schema.safeParse({ ...createInput, ageAtRecording });
      assert.equal(result.success, false, `Unexpectedly accepted ${String(ageAtRecording)}`);
      if (!result.success) {
        assert.equal(result.error.flatten().fieldErrors.ageAtRecording?.[0], CUSTOMER_AGE_ERROR);
      }
    }
  }
});

test("clients cannot set the age recording timestamp", () => {
  for (const schema of [createCustomerSchema, updateCustomerSchema]) {
    assert.equal(
      schema.safeParse({
        ...createInput,
        ageAtRecording: 30,
        ageRecordedAt: originalDate.toISOString(),
      }).success,
      false,
    );
  }
});

test("both forms distinguish empty age, zero, valid integers and invalid text", () => {
  for (const value of ["", "  "]) assert.equal(parseCustomerAge(value), null);
  for (const [value, expected] of [
    ["0", 0],
    ["120", 120],
    [" 25 ", 25],
  ] as const) {
    assert.equal(parseCustomerAge(value), expected);
  }
  for (const value of ["-1", "121", "25.5", "25.0", "1e2", "NaN", "Infinity", "abc", "1 2"]) {
    assert.equal(parseCustomerAge(value), undefined);
  }
});

test("creating a customer without age stores two nulls and preserves gender and billing", async (t) => {
  const { services, writes, purchases } = await customerStore(t);
  const customer = await services.createCustomer(createCustomerSchema.parse(createInput));
  assert.equal(customer.ageAtRecording, null);
  assert.equal(customer.ageRecordedAt, null);
  assert.equal(writes[0].gender, "Female");
  assert.equal(writes[0].mobNumber, "9876543210");
  assert.equal(purchases[0].mrp, 0.3);
  assert.equal(purchases[0].frameRate, 0.1);
  assert.equal(purchases[0].lensRate, 0.2);
});

for (const ageAtRecording of [0, 120]) {
  test(`creating a customer with age ${ageAtRecording} records a server timestamp`, async (t) => {
    const { services } = await customerStore(t);
    const before = Date.now();
    const customer = await services.createCustomer(
      createCustomerSchema.parse({ ...createInput, ageAtRecording }),
    );
    assert.equal(customer.ageAtRecording, ageAtRecording);
    assert.ok(customer.ageRecordedAt instanceof Date);
    assert.ok(
      customer.ageRecordedAt.getTime() >= before && customer.ageRecordedAt.getTime() <= Date.now(),
    );
  });
}

for (const previousAge of [null, 29]) {
  test(`adding or changing age from ${previousAge} sets a new recording timestamp`, async (t) => {
    const { services, writes, purchases } = await customerStore(t, previousAge);
    const before = Date.now();
    const customer = await services.updateCustomer(
      customerId,
      updateCustomerSchema.parse({ ageAtRecording: 30 }),
    );
    assert.equal(customer?.ageAtRecording, 30);
    assert.ok(customer?.ageRecordedAt instanceof Date);
    assert.ok(
      customer.ageRecordedAt.getTime() >= before && customer.ageRecordedAt.getTime() <= Date.now(),
    );
    assert.equal(writes.length, 1);
    assert.equal(purchases.length, 0);
  });
}

test("omitted and unchanged ages preserve the original value and timestamp", async (t) => {
  const { services, writes } = await customerStore(t, 0);
  for (const update of [{ name: "Updated Name", gender: "Male" }, { ageAtRecording: 0 }]) {
    const customer = await services.updateCustomer(customerId, updateCustomerSchema.parse(update));
    assert.equal(customer?.ageAtRecording, 0);
    assert.equal(customer?.ageRecordedAt?.toISOString(), originalDate.toISOString());
    assert.equal(customer?.gender, "Male");
    assert.equal(customer?.records[0]?.mrp, "0.30");
    assert.equal(Object.hasOwn(writes.at(-1)!, "ageAtRecording"), false);
    assert.equal(Object.hasOwn(writes.at(-1)!, "ageRecordedAt"), false);
  }
});

test("intentionally clearing age clears both fields, including blank form input", async (t) => {
  const { services } = await customerStore(t, 30);
  for (const ageAtRecording of [null, ""]) {
    await services.updateCustomer(customerId, updateCustomerSchema.parse({ ageAtRecording: 30 }));
    const customer = await services.updateCustomer(
      customerId,
      updateCustomerSchema.parse({ ageAtRecording }),
    );
    assert.equal(customer?.ageAtRecording, null);
    assert.equal(customer?.ageRecordedAt, null);
  }
});

test("legacy customers retain null ages when other fields change", async (t) => {
  const { services, writes } = await customerStore(t);
  const customer = await services.updateCustomer(
    customerId,
    updateCustomerSchema.parse({ reference: "Walk-in" }),
  );
  assert.equal(customer?.ageAtRecording, null);
  assert.equal(customer?.ageRecordedAt, null);
  assert.equal(customer?.reference, "Walk-in");
  assert.equal(Object.hasOwn(writes[0], "ageRecordedAt"), false);
});

test("customer API responses serialize recorded ages and reject invalid age requests", async (t) => {
  await customerStore(t);
  const { addCustomer, editCustomer, showCustomer } =
    await import("../src/controllers/customerController");
  const app = express();
  app.use(express.json());
  app.post("/customers", addCustomer);
  app.patch("/customers/:id", editCustomer);
  app.get("/customers/:id", showCustomer);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/customers`;
  try {
    const created = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...createInput, ageAtRecording: 35 }),
    });
    assert.equal(created.status, 201);
    const createdData = (await created.json()).data;
    assert.equal(createdData.ageAtRecording, 35);
    assert.ok(Number.isFinite(Date.parse(createdData.ageRecordedAt)));
    const detail = await fetch(`${base}/${customerId}`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).data.ageRecordedAt, createdData.ageRecordedAt);
    for (const [method, url, body] of [
      ["POST", base, { ...createInput, ageAtRecording: -1 }],
      ["PATCH", `${base}/${customerId}`, { ageAtRecording: 121 }],
    ] as const) {
      const invalid = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(invalid.status, 400);
      assert.equal((await invalid.json()).message, CUSTOMER_AGE_ERROR);
    }
    const cleared = await fetch(`${base}/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ageAtRecording: null }),
    });
    assert.equal(cleared.status, 200);
    const clearedData = (await cleared.json()).data;
    assert.equal(clearedData.ageAtRecording, null);
    assert.equal(clearedData.ageRecordedAt, null);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("search still supports shared mobile numbers and name matching without age lookups", async (t) => {
  const { prisma, services } = await customerStore(t);
  const customers = [
    { id: "one", mobNumber: "9876543210" },
    { id: "two", mobNumber: "9876543210" },
  ];
  const search = mockPrismaMethod(t, prisma.customer, "findMany", async () => customers);
  assert.deepEqual(await services.searchCustomers("9876543210", "Test"), customers);
  const query = search.mock.calls[0].arguments[0] as unknown as { where: unknown; select: object };
  assert.deepEqual(query.where, {
    shopId: "shop-1",
    isActive: true,
    mobNumber: { contains: "9876543210" },
    name: { contains: "Test", mode: "insensitive" },
  });
  assert.equal(Object.hasOwn(query.select, "ageAtRecording"), false);
});

test("recorded age does not change receipt, prescription or WhatsApp document content", () => {
  const prescription: Prescription = {
    id: "prescription-1",
    createdAt: originalDate.toISOString(),
    reDistSph: null,
    reDistCyl: null,
    reDistAxis: null,
    reNearSph: null,
    reNearCyl: null,
    reNearAxis: null,
    leDistSph: null,
    leDistCyl: null,
    leDistAxis: null,
    leNearSph: null,
    leNearCyl: null,
    leNearAxis: null,
  };
  const purchase: CustomerRecord = {
    id: "purchase-1",
    prescriptionId: prescription.id,
    specsType: "Frame",
    lensType: "Lens",
    frameCatalogId: null,
    lensCatalogId: null,
    pricingMode: "SPLIT",
    frameRate: "100",
    lensRate: "200",
    mrp: "300",
    purchaseDate: "2026-01-10",
    createdAt: originalDate.toISOString(),
  };
  const customer: CustomerDetails = {
    id: customerId,
    name: "Test Customer",
    mobNumber: "9876543210",
    gender: "Female",
    reference: null,
    notes: null,
    createdAt: originalDate.toISOString(),
    updatedAt: originalDate.toISOString(),
    ageAtRecording: null,
    ageRecordedAt: null,
    prescriptions: [prescription],
    records: [purchase],
  };
  const documents = (value: CustomerDetails) => [
    receiptHtml(value, purchase, prescription),
    prescriptionHtml(value, prescription),
    whatsappReceiptMessage(value, purchase, prescription),
  ];
  assert.deepEqual(
    documents({ ...customer, ageAtRecording: 119, ageRecordedAt: "2026-10-17T10:00:00.000Z" }),
    documents(customer),
  );
});
