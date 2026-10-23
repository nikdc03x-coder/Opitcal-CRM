import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";

const selected = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";

async function setup(t: TestContext) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  mockPrismaMethod(t, prisma.shop, "findUnique", async () => ({ id: "shop-1" }));
  const rows = {
    frameCatalog: [
      { id: selected, shopId: "shop-1", isActive: false },
      { id: other, shopId: "shop-1", isActive: true },
    ],
    lensCatalog: [
      { id: selected, shopId: "shop-1", isActive: false },
      { id: other, shopId: "shop-1", isActive: true },
    ],
  };
  for (const model of ["frameCatalog", "lensCatalog"] as const) {
    mockPrismaMethod(
      t,
      prisma[model],
      "deleteMany",
      async ({ where }: { where: { id: string; shopId: string } }) => {
        assert.equal(typeof where.id, "string", "Deletion must target exactly one ID");
        assert.equal(where.shopId, "shop-1");
        const before = rows[model].length;
        rows[model] = rows[model].filter(
          (row) => row.id !== where.id || row.shopId !== where.shopId,
        );
        return { count: before - rows[model].length };
      },
    );
  }
  for (const model of ["customer", "customerRecord", "prescription", "order"] as const) {
    for (const method of ["delete", "deleteMany", "update", "updateMany"])
      mockPrismaMethod(t, prisma[model], method, () =>
        assert.fail(`${model} must not be mutated by catalog deletion`),
      );
  }
  return { prisma, rows, service: await import("../src/services/catalogService") };
}

for (const kind of ["Frame", "Lens"] as const) {
  test(`deleting one ${kind.toLowerCase()} preserves other items and scopes the shop`, async (t) => {
    const { rows, service } = await setup(t);
    const remove = kind === "Frame" ? service.deleteFrame : service.deleteLens;
    const model = kind === "Frame" ? "frameCatalog" : "lensCatalog";
    const untouched = kind === "Frame" ? "lensCatalog" : "frameCatalog";
    assert.equal(await remove(selected), true);
    assert.deepEqual(
      rows[model].map((row) => row.id),
      [other],
    );
    assert.equal(rows[untouched].length, 2);
    assert.equal(await remove(selected), false);
    rows[model].push({ id: selected, shopId: "another-shop", isActive: true });
    assert.equal(await remove(selected), false);
    assert.equal(rows[model].length, 2);
    assert.equal(await remove(other), true, "Active items can also be deleted individually");
  });
}

test("catalog DELETE routes validate IDs, report missing items, and delete the selected kind only", async (t) => {
  const { rows } = await setup(t);
  const { default: router } = await import("../src/routes/catalogRoutes");
  const app = express();
  app.use("/catalog", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/catalog`;
  for (const kind of ["frames", "lenses"]) {
    assert.equal((await fetch(`${base}/${kind}/invalid`, { method: "DELETE" })).status, 400);
    const response = await fetch(`${base}/${kind}/${selected}`, { method: "DELETE" });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, { id: selected });
    assert.equal((await fetch(`${base}/${kind}/${selected}`, { method: "DELETE" })).status, 404);
    assert.equal((await fetch(`${base}/${kind}`, { method: "DELETE" })).status, 404);
  }
  assert.deepEqual(
    rows.frameCatalog.map((row) => row.id),
    [other],
  );
  assert.deepEqual(
    rows.lensCatalog.map((row) => row.id),
    [other],
  );
});

test("catalog deletion endpoints retain administrator authentication", async (t) => {
  await setup(t);
  const { default: app } = await import("../src/app");
  const { clientOrigin } = await import("../src/config/authConfig");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  for (const kind of ["frames", "lenses"]) {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/catalog/${kind}/${selected}`,
      { method: "DELETE", headers: { Origin: clientOrigin() } },
    );
    assert.equal(response.status, 401);
  }
});

test("catalog client deletes only the encoded item and exposes failure without success", async (t) => {
  const { deleteFrame, deleteLens } = await import("../../client/src/services/catalogApi");
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: { id: selected } }),
  );
  await deleteFrame("frame/1");
  await deleteLens("lens/2");
  assert.deepEqual(
    request.mock.calls.map((call) => call.arguments[0]),
    ["/api/catalog/frames/frame%2F1", "/api/catalog/lenses/lens%2F2"],
  );
  for (const call of request.mock.calls) {
    const options = call.arguments[1] as RequestInit;
    assert.equal(options.method, "DELETE");
    assert.equal(options.credentials, "include");
  }
  request.mock.mockImplementation(async () =>
    Response.json({ success: false, message: "Deletion failed" }, { status: 503 }),
  );
  await assert.rejects(deleteFrame(selected), /Deletion failed/);
  await assert.rejects(deleteLens(selected), /Deletion failed/);
});
