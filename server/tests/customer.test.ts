import assert from "node:assert/strict";
import test from "node:test";
import { createCustomerSchema } from "../src/validators/customerWriteValidator";
import { purchaseUpdateSchema } from "../src/validators/historyValidator";
import { calculatePricing } from "../src/utils/pricing";
import { resolveCatalogSelection, CatalogSelectionError } from "../src/services/catalogSelection";

test("customer creation and purchase edits reject impossible calendar dates", () => {
  const record = { pricingMode: "MRP_ONLY", mrp: 100 };
  for (const purchaseDate of ["2026-02-29", "2026-13-01", "2026-1-01"]) {
    assert.equal(
      createCustomerSchema.safeParse({ name: "Test", record, purchaseDate }).success,
      false,
    );
    assert.equal(purchaseUpdateSchema.safeParse({ record, purchaseDate }).success, false);
  }
  assert.equal(purchaseUpdateSchema.safeParse({ record }).success, false);
  for (const purchaseDate of [null, "2024-02-29", "2026-10-16"]) {
    assert.equal(purchaseUpdateSchema.safeParse({ record, purchaseDate }).success, true);
  }
});

test("pricing adds paise precisely and clears split rates in MRP mode", () => {
  assert.deepEqual(calculatePricing({ pricingMode: "SPLIT", frameRate: 0.1, lensRate: 0.2 }), {
    pricingMode: "SPLIT",
    frameRate: 0.1,
    lensRate: 0.2,
    mrp: 0.3,
  });
  assert.deepEqual(calculatePricing({ pricingMode: "MRP_ONLY", mrp: 500 }), {
    pricingMode: "MRP_ONLY",
    frameRate: null,
    lensRate: null,
    mrp: 500,
  });
});

type CatalogClient = Parameters<typeof resolveCatalogSelection>[0];

test("editing a purchase preserves its previously linked inactive products and historical names", async () => {
  const tx = {
    frameCatalog: { findFirst: () => assert.fail("Existing frame must not be reselected") },
    lensCatalog: { findFirst: () => assert.fail("Existing lens must not be reselected") },
  } as unknown as CatalogClient;
  const existing = {
    frameCatalogId: "frame-1",
    lensCatalogId: "lens-1",
    specsType: "Original frame name",
    lensType: "Original lens name",
  };
  const selection = await resolveCatalogSelection(
    tx,
    "shop-1",
    {
      pricingMode: "MRP_ONLY",
      mrp: 500,
      frameCatalogId: "frame-1",
      lensCatalogId: "lens-1",
      specsType: "Renamed frame",
      lensType: "Renamed lens",
    },
    existing,
  );
  assert.deepEqual(selection, existing);
});

test("new product selections require an active product in the same shop", async () => {
  const tx = {
    frameCatalog: {
      findFirst: async (query: unknown) => {
        assert.deepEqual(query, {
          where: { id: "new-frame", shopId: "shop-1", isActive: true },
          select: { id: true, brand: true, model: true },
        });
        return null;
      },
    },
  } as unknown as CatalogClient;
  await assert.rejects(
    resolveCatalogSelection(tx, "shop-1", {
      pricingMode: "MRP_ONLY",
      mrp: 500,
      frameCatalogId: "new-frame",
    }),
    CatalogSelectionError,
  );
});

test("clearing catalog links accepts manual product descriptions", async () => {
  const selection = await resolveCatalogSelection(
    {} as CatalogClient,
    "shop-1",
    {
      pricingMode: "MRP_ONLY",
      mrp: 500,
      frameCatalogId: null,
      lensCatalogId: null,
      specsType: "Manual frame",
      lensType: "Manual lens",
    },
    {
      frameCatalogId: "old-frame",
      lensCatalogId: "old-lens",
      specsType: "Old frame",
      lensType: "Old lens",
    },
  );
  assert.deepEqual(selection, {
    frameCatalogId: null,
    lensCatalogId: null,
    specsType: "Manual frame",
    lensType: "Manual lens",
  });
});
