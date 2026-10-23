import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../src/validators/customerWriteValidator";
import {
  createPurchaseRecordSchema,
  purchaseUpdateSchema,
} from "../src/validators/historyValidator";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";

test("all purchase write validators reject a split total outside Decimal(12,2)", () => {
  const record = {
    pricingMode: "SPLIT",
    specsType: "Synthetic Frame",
    lensType: "Synthetic Lens",
    frameRate: 9999999999.99,
    lensRate: 0.01,
  };
  for (const [schema, input] of [
    [createCustomerSchema, { name: "Synthetic", record }],
    [updateCustomerSchema, { record }],
    [createPurchaseRecordSchema, { record }],
    [purchaseUpdateSchema, { record, purchaseDate: null }],
  ] as const) {
    assert.equal(schema.safeParse(input).success, false);
    assert.equal(
      schema.safeParse({ ...input, record: { ...record, frameRate: 9999999999.98 } }).success,
      true,
    );
  }
});

test("new MRP purchases accept a catalog-only frame, lens or combined selection", () => {
  const id = "10000000-0000-4000-8000-000000000001";
  for (const catalog of [
    { frameCatalogId: id },
    { lensCatalogId: id },
    { frameCatalogId: id, lensCatalogId: id },
  ]) {
    assert.equal(
      createPurchaseRecordSchema.safeParse({
        record: { pricingMode: "MRP_ONLY", mrp: 50, ...catalog },
      }).success,
      true,
    );
  }
  assert.equal(
    createPurchaseRecordSchema.safeParse({ record: { pricingMode: "MRP_ONLY", mrp: 50 } }).success,
    false,
  );
});

test("a demoted account cannot permanently delete with its retained administrator PIN", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://crm.example.test";
  const { prisma } = await import("../src/config/database");
  const { requireAdmin } = await import("../src/middleware/auth");
  const { permanentlyDelete } = await import("../src/controllers/permanentDeletionController");
  const { errorHandler } = await import("../src/middleware/errorHandler");
  mockPrismaMethod(t, prisma.adminSession, "findUnique", async () => ({
    expiresAt: new Date(Date.now() + 60000),
    admin: { id: 1, username: "synthetic-former-admin", role: "USER", isActive: true },
  }));
  const pinLookup = mockPrismaMethod(t, prisma, "$transaction", () =>
    assert.fail("Non-admin must be denied before PIN verification or deletion"),
  );
  const app = express();
  app.use(express.json());
  app.delete("/:id/permanent", requireAdmin, permanentlyDelete);
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const response = await fetch(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/10000000-0000-4000-8000-000000000001/permanent`,
    {
      method: "DELETE",
      headers: {
        Origin: process.env.CLIENT_URL,
        "Content-Type": "application/json",
        Cookie: `optical_crm_session=${"a".repeat(64)}`,
      },
      body: JSON.stringify({ pin: "9090" }),
    },
  );
  assert.equal(response.status, 403);
  assert.equal(pinLookup.mock.calls.length, 0);
});
