// Opt-in integration audit. Never reads application credentials into the runtime.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import http from "node:http";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(path.join(root, "server/package.json"));
const dotenv = require("dotenv");
const { Client } = require("pg");
const out = path.join(root, "artifacts/crud-audit");
await fs.mkdir(out, { recursive: true });
const env = dotenv.parse(await fs.readFile(path.join(root, "server/.env.audit")));
const configured = dotenv.parse(await fs.readFile(path.join(root, "server/.env")));
const target = new URL(env.DIRECT_URL);
const pooled = new URL(env.DATABASE_URL);
const expectedHost = "ep-sweet-morning-b4g3qj7f.c-6.us-east-2.aws.neon.tech";
const expectedDatabase = "crm_crud_audit_20261023";
assert.equal(process.argv[2], expectedHost, "Explicit audit endpoint acknowledgement required");
assert.equal(target.hostname, expectedHost);
assert.equal(target.pathname, "/" + expectedDatabase);
assert.equal(pooled.hostname.replace("-pooler.", "."), expectedHost);
assert.equal(pooled.pathname, target.pathname);
assert.notEqual(
  new URL(configured.DIRECT_URL).hostname,
  expectedHost,
  "Refusing configured database",
);
assert.notEqual(new URL(configured.DATABASE_URL).hostname.replace("-pooler.", "."), expectedHost);
assert.equal(env.NODE_ENV, "test");
assert.equal(env.SMTP_USER, "");
assert.equal(env.RESEND_API_KEY, "");
Object.assign(process.env, env);
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
const sql = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: true } });
await sql.connect();
assert.equal((await sql.query("SELECT current_database() AS name")).rows[0].name, expectedDatabase);
await sql.query("CREATE SCHEMA IF NOT EXISTS audit_control");
// Move the initial safety marker out of Prisma's managed public schema.
if (
  (await sql.query("SELECT to_regclass('public.crm_crud_audit_marker') IS NOT NULL AS present"))
    .rows[0].present
) {
  assert.equal(
    (await sql.query("SELECT purpose FROM public.crm_crud_audit_marker")).rows[0].purpose,
    "synthetic-crud-audit-20261023",
  );
  await sql.query("ALTER TABLE public.crm_crud_audit_marker SET SCHEMA audit_control");
}
const marker = await sql.query(
  "SELECT to_regclass('audit_control.crm_crud_audit_marker') IS NOT NULL AS present",
);
if (!marker.rows[0].present) {
  const tables = await sql.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  assert.equal(tables.rowCount, 0, "New audit database must be empty");
  await sql.query("CREATE TABLE audit_control.crm_crud_audit_marker (purpose text PRIMARY KEY)");
  await sql.query("INSERT INTO audit_control.crm_crud_audit_marker VALUES ($1)", [
    "synthetic-crud-audit-20261023",
  ]);
}
assert.equal(
  (await sql.query("SELECT purpose FROM audit_control.crm_crud_audit_marker")).rows[0].purpose,
  "synthetic-crud-audit-20261023",
);
console.log("Audit database identity and safety marker verified; deploying migrations.");
const migration = spawnSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  {
    cwd: path.join(root, "server"),
    env: process.env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
  },
);
// Prisma's normal output contains no URL; do not print errors that might contain credentials.
await fs.writeFile(path.join(out, "migrations.log"), migration.stdout + migration.stderr);
assert.equal(migration.status, 0, "Audit migrations failed; inspect local migrations.log");
console.log("Verified isolated endpoint and empty audit database; migrations applied.");
if (process.argv.includes("--setup-only")) {
  await sql.end();
  process.exit(0);
}

const { prisma } = require(path.join(root, "server/dist/config/database.js"));
const { hashPassword } = require(path.join(root, "server/dist/services/authService.js"));
const { setDeletionPin } = require(path.join(root, "server/dist/services/deletionPinService.js"));
const app = require(path.join(root, "server/dist/app.js")).default;
const results = [];
const metrics = [];
let queryCount = 0;
const originalQuery = Client.prototype.query;
Client.prototype.query = function (...args) {
  queryCount++;
  return originalQuery.apply(this, args);
};
const password = randomBytes(24).toString("hex");
const pin = String(Math.floor(Math.random() * 9000) + 1000);
const suffix = randomBytes(5).toString("hex");
const shop = await prisma.shop.create({
  data: { code: "DEMO_SHOP", name: "Synthetic Audit Shop" },
});
const otherShop = await prisma.shop.create({
  data: { code: "AUDIT_OTHER", name: "Synthetic Other Shop" },
});
const admin = await prisma.admin.create({
  data: {
    username: "audit-admin-" + suffix,
    passwordHash: await hashPassword(password),
    name: "Synthetic Administrator",
    email: "admin@example.test",
    role: "ADMIN",
  },
});
const user = await prisma.admin.create({
  data: {
    username: "audit-user-" + suffix,
    passwordHash: await hashPassword(password),
    name: "Synthetic Staff",
    email: "staff@example.test",
    role: "USER",
  },
});
await setDeletionPin(admin.id, pin);
const server = http
  .createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) return app(req, res);
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const dist = path.join(root, "client/dist");
    let filename = path.resolve(dist, "." + pathname);
    if (!filename.startsWith(dist + path.sep)) filename = path.join(dist, "index.html");
    let bytes;
    try {
      bytes = await fs.readFile(filename);
    } catch {
      filename = path.join(dist, "index.html");
      bytes = await fs.readFile(filename);
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      }[path.extname(filename)] ?? "application/octet-stream",
    );
    res.end(bytes);
  })
  .listen(5180, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:5180";
const jars = { admin: new Map(), user: new Map(), guest: new Map() };
async function request(route, method = "GET", body, who = "admin", expected = 200) {
  const start = performance.now(),
    before = queryCount;
  const response = await fetch(base + "/api" + route, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: [...jars[who]].map(([k, v]) => k + "=" + v).join("; "),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  for (const item of response.headers.getSetCookie()) {
    const [k, v] = item.split(";")[0].split("=");
    v ? jars[who].set(k, v) : jars[who].delete(k);
  }
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  metrics.push({
    method,
    route,
    status: response.status,
    milliseconds: Math.round(performance.now() - start),
    queries: queryCount - before,
    bytes: Buffer.byteLength(text),
  });
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: expected ${expected}, received ${response.status}: ${json.message ?? ""}`,
  );
  return json;
}
async function check(name, endpoint, run) {
  try {
    await run();
    results.push({ name, endpoint, status: "PASS" });
    console.log("PASS:", name);
  } catch (error) {
    results.push({ name, endpoint, status: "FAIL", error: error.message });
    console.log("FAIL:", name, error.message);
  }
}
const purchase = (name = "Synthetic Frame", price = 100.25) => ({
  pricingMode: "SPLIT",
  specsType: name,
  frameRate: price,
  lensRate: null,
});
const customerPayload = (name = "Synthetic Customer") => ({
  name,
  mobNumber: "9876543210",
  gender: "Other",
  ageAtRecording: 30,
  reference: "Synthetic reference",
  notes: "Synthetic private note",
  record: purchase(),
  purchaseDate: "2026-10-01",
});
const persisted = async (id) => (await request("/customers/" + id)).data;
let customer, frame, lens, foreignCustomer, foreignPurchase, foreignRx;

try {
  await request("/auth/login", "POST", { username: admin.username, password });
  await request("/auth/login", "POST", { username: user.username, password }, "user");
  if (!process.argv.includes("--browser-only") && !process.argv.includes("--edge-only")) {
    await check(
      "catalog create/read/update and stored fields",
      "/catalog/{frames,lenses}",
      async () => {
        frame = (
          await request(
            "/catalog/frames",
            "POST",
            { brand: "Audit", model: "Frame", frameCode: "SYN-F" },
            "admin",
            201,
          )
        ).data;
        lens = (
          await request(
            "/catalog/lenses",
            "POST",
            { company: "Audit", lensName: "Lens", visionType: "Single", coating: "Clear" },
            "admin",
            201,
          )
        ).data;
        assert(frame?.id && lens?.id);
        await request("/catalog/frames/" + frame.id, "PATCH", { frameStyle: "Round" });
        assert.equal(
          (await prisma.frameCatalog.findUniqueOrThrow({ where: { id: frame.id } })).frameStyle,
          "Round",
        );
        assert((await request("/catalog/frames?search=Audit")).data.some((x) => x.id === frame.id));
        await request("/catalog/lenses/" + lens.id, "PATCH", { coating: "AR" });
        assert.equal(
          (await prisma.lensCatalog.findUniqueOrThrow({ where: { id: lens.id } })).coating,
          "AR",
        );
        assert((await request("/catalog/lenses?search=Audit")).data.some((x) => x.id === lens.id));
      },
    );
    await check(
      "customer create with prescription, zero powers and exact prices",
      "/customers",
      async () => {
        customer = (
          await request(
            "/customers",
            "POST",
            {
              ...customerPayload(),
              record: {
                pricingMode: "SPLIT",
                frameCatalogId: frame.id,
                lensCatalogId: lens.id,
                frameRate: 100.25,
                lensRate: 200.5,
              },
              prescription: { re_dist: { sph: 0, cyl: -0.5, axis: 180 }, le_near: { sph: 1.25 } },
            },
            "admin",
            201,
          )
        ).data;
        const row = await prisma.customer.findUniqueOrThrow({
          where: { id: customer.id },
          include: { records: true, prescriptions: true },
        });
        assert.equal(row.records[0].mrp.toString(), "300.75");
        assert.equal(row.prescriptions[0].reDistSph.toString(), "0");
        assert.equal(row.records[0].prescriptionId, row.prescriptions[0].id);
        assert.equal(row.prescriptions[0].createdForPurchaseId, row.records[0].id);
        assert.equal((await persisted(customer.id)).records[0].mrp, "300.75");
      },
    );
    for (const [name, record] of [
      ["Frame Only", purchase()],
      [
        "Lens Only",
        { pricingMode: "SPLIT", lensType: "Synthetic Lens", lensRate: 75.75, frameRate: null },
      ],
      [
        "Frame + Lens",
        { pricingMode: "SPLIT", specsType: "F", lensType: "L", frameRate: 10.1, lensRate: 20.2 },
      ],
      ["MRP_ONLY", { pricingMode: "MRP_ONLY", specsType: "Synthetic Manual", mrp: 99.99 }],
    ]) {
      await check("create required-only customer: " + name, "/customers", async () => {
        const row = (
          await request("/customers", "POST", { name: "Synthetic " + name, record }, "admin", 201)
        ).data;
        const db = await prisma.customer.findUniqueOrThrow({
          where: { id: row.id },
          include: { records: true, prescriptions: true },
        });
        assert.equal(db.prescriptions.length, 0);
        assert.equal(db.ageAtRecording, null);
        assert.equal(db.mobNumber, null);
        assert.equal((await persisted(row.id)).records[0].id, db.records[0].id);
      });
    }
    await check(
      "personal PATCH preserves omitted fields and clears explicit optional fields",
      "/customers/:id",
      async () => {
        await request("/customers/" + customer.id, "PATCH", { name: "Synthetic Updated" });
        let row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
        assert.equal(row.mobNumber, "9876543210");
        assert.equal(row.notes, "Synthetic private note");
        await request("/customers/" + customer.id, "PATCH", {
          mobNumber: null,
          gender: "Female",
          ageAtRecording: null,
          reference: null,
          notes: "Updated private note",
        });
        row = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
        assert.equal(row.ageRecordedAt, null);
        assert.equal(row.reference, null);
        assert.equal(row.notes, "Updated private note");
        assert.equal((await persisted(customer.id)).gender, "Female");
      },
    );
    await check(
      "invalid phone, age, date, prices, IDs and bodies never create records",
      "/customers",
      async () => {
        const before = await prisma.customer.count();
        for (const patch of [
          { mobNumber: "123" },
          { ageAtRecording: -1 },
          { ageAtRecording: 1.5 },
          { purchaseDate: "2026-02-30" },
          { record: purchase("F", -1) },
          { record: purchase("F", 1.001) },
          { prescription: { re_dist: { axis: 181 } } },
          { shopId: otherShop.id },
        ])
          await request("/customers", "POST", { ...customerPayload(), ...patch }, "admin", 400);
        await request("/customers/bad", "PATCH", { name: "x" }, "admin", 400);
        await request("/customers/" + customer.id, "PATCH", {}, "admin", 400);
        assert.equal(await prisma.customer.count(), before);
      },
    );
    await check(
      "split totals exceeding database precision are rejected before writing",
      "/customers; /customers/:id/records/:recordId",
      async () => {
        const huge = {
          pricingMode: "SPLIT",
          specsType: "Synthetic F",
          lensType: "Synthetic L",
          frameRate: 9999999999.99,
          lensRate: 1,
        };
        await request(
          "/customers",
          "POST",
          { ...customerPayload("Synthetic Overflow"), record: huge },
          "admin",
          400,
        );
        await request(
          "/customers/" + customer.id + "/records/" + customer.records[0].id,
          "PATCH",
          { record: huge, purchaseDate: null },
          "admin",
          400,
        );
        assert.equal(await prisma.customer.count({ where: { name: "Synthetic Overflow" } }), 0);
      },
    );
    await check(
      "new purchases: all product types, new/existing/no prescription, independent history",
      "/customers/:id/records",
      async () => {
        const rxId = customer.prescriptions[0].id;
        for (const payload of [
          { record: purchase("Synthetic Second"), prescriptionId: rxId },
          {
            record: {
              pricingMode: "SPLIT",
              lensType: "Synthetic L",
              lensRate: 25,
              frameRate: null,
            },
            prescription: { le_dist: { sph: 0, cyl: 0, axis: 0 } },
          },
          {
            record: {
              pricingMode: "MRP_ONLY",
              specsType: "Synthetic F",
              lensType: "Synthetic L",
              mrp: 500,
            },
          },
        ]) {
          const row = (
            await request("/customers/" + customer.id + "/records", "POST", payload, "admin", 201)
          ).data;
          const db = await prisma.customerRecord.findUniqueOrThrow({ where: { id: row.id } });
          assert.equal(db.customerId, customer.id);
          assert.equal(db.prescriptionId, row.prescriptionId);
          assert((await persisted(customer.id)).records.some((x) => x.id === row.id));
        }
      },
    );
    await check(
      "catalog-only MRP purchase resolves selected product IDs",
      "/customers/:id/records",
      async () => {
        const row = (
          await request(
            "/customers/" + customer.id + "/records",
            "POST",
            { record: { pricingMode: "MRP_ONLY", frameCatalogId: frame.id, mrp: 50 } },
            "admin",
            201,
          )
        ).data;
        assert.equal(
          (await prisma.customerRecord.findUniqueOrThrow({ where: { id: row.id } })).frameCatalogId,
          frame.id,
        );
      },
    );
    await check(
      "historical purchase edits preserve inactive snapshots and clear links for manual products",
      "/customers/:id/records/:recordId",
      async () => {
        const id = customer.records[0].id,
          route = "/customers/" + customer.id + "/records/" + id;
        const other = await prisma.customerRecord.findMany({
          where: { customerId: customer.id, id: { not: id } },
        });
        await request("/catalog/frames/" + frame.id, "PATCH", {
          isActive: false,
          brand: "Renamed",
        });
        await request(route, "PATCH", {
          record: {
            pricingMode: "SPLIT",
            frameCatalogId: frame.id,
            lensCatalogId: lens.id,
            frameRate: 20.1,
            lensRate: 30.2,
          },
          purchaseDate: "2020-02-29",
        });
        let row = await prisma.customerRecord.findUniqueOrThrow({ where: { id } });
        assert.equal(row.specsType, "Audit - Frame");
        assert.equal(row.mrp.toString(), "50.3");
        await request(route, "PATCH", {
          record: {
            pricingMode: "MRP_ONLY",
            frameCatalogId: null,
            lensCatalogId: null,
            specsType: "Synthetic Manual",
            lensType: null,
            mrp: 500.5,
          },
          purchaseDate: null,
        });
        row = await prisma.customerRecord.findUniqueOrThrow({ where: { id } });
        assert.equal(row.frameCatalogId, null);
        assert.equal(row.lensCatalogId, null);
        assert.equal(row.frameRate, null);
        assert.equal(row.lensRate, null);
        assert.deepEqual(
          await prisma.customerRecord.findMany({
            where: { customerId: customer.id, id: { not: id } },
          }),
          other,
        );
        assert.equal((await persisted(customer.id)).records.find((x) => x.id === id).mrp, "500.5");
      },
    );
    await check(
      "prescription selected ID, zero/null/partial updates and unrelated-history protection",
      "/customers/:id/prescriptions/:prescriptionId",
      async () => {
        const id = customer.prescriptions[0].id;
        const other = await prisma.prescription.findMany({
          where: { customerId: customer.id, id: { not: id } },
        });
        await request("/customers/" + customer.id + "/prescriptions/" + id, "PATCH", {
          re_dist: { sph: 0, cyl: null },
          le_near: { axis: 90 },
        });
        const db = await prisma.prescription.findUniqueOrThrow({ where: { id } });
        assert.equal(db.reDistSph.toString(), "0");
        assert.equal(db.reDistCyl, null);
        assert.equal(db.reDistAxis, 180);
        assert.equal(db.leNearAxis, 90);
        assert.deepEqual(
          await prisma.prescription.findMany({
            where: { customerId: customer.id, id: { not: id } },
          }),
          other,
        );
        assert.equal(
          (await persisted(customer.id)).prescriptions.find((x) => x.id === id).reDistCyl,
          null,
        );
        await request(
          "/customers/" + customer.id + "/prescriptions/" + id,
          "PATCH",
          { re_dist: { sph: 31 } },
          "admin",
          400,
        );
      },
    );
    await check(
      "shop/customer/purchase/prescription/catalog ownership rejects tampered IDs",
      "/customers/*; /catalog/*; /orders/*",
      async () => {
        foreignCustomer = await prisma.customer.create({
          data: { shopId: otherShop.id, name: "Synthetic Foreign" },
        });
        foreignRx = await prisma.prescription.create({
          data: { customerId: foreignCustomer.id, reDistSph: 2 },
        });
        foreignPurchase = await prisma.customerRecord.create({
          data: { customerId: foreignCustomer.id, prescriptionId: foreignRx.id, mrp: 10 },
        });
        const foreignFrame = await prisma.frameCatalog.create({
          data: { shopId: otherShop.id, brand: "Foreign", model: "F" },
        });
        await request("/customers/" + foreignCustomer.id, "GET", undefined, "admin", 404);
        await request(
          "/customers/" + foreignCustomer.id,
          "PATCH",
          { name: "Hijack" },
          "admin",
          404,
        );
        await request("/customers/" + foreignCustomer.id, "DELETE", undefined, "admin", 404);
        await request(
          "/customers/" + customer.id + "/records/" + foreignPurchase.id,
          "PATCH",
          { record: purchase(), purchaseDate: null },
          "admin",
          404,
        );
        await request(
          "/customers/" + customer.id + "/prescriptions/" + foreignRx.id,
          "PATCH",
          { re_dist: { sph: 3 } },
          "admin",
          404,
        );
        await request(
          "/customers/" + customer.id + "/records",
          "POST",
          { record: purchase(), prescriptionId: foreignRx.id },
          "admin",
          400,
        );
        await request(
          "/customers",
          "POST",
          {
            ...customerPayload(),
            record: { pricingMode: "MRP_ONLY", frameCatalogId: foreignFrame.id, mrp: 10 },
          },
          "admin",
          400,
        );
        await request("/catalog/frames/" + foreignFrame.id, "DELETE", undefined, "admin", 404);
        assert.equal(
          (await prisma.customer.findUniqueOrThrow({ where: { id: foreignCustomer.id } })).name,
          "Synthetic Foreign",
        );
      },
    );
  }
  if (!customer)
    customer = (
      await request(
        "/customers",
        "POST",
        {
          ...customerPayload("Synthetic Browser Prerequisite"),
          prescription: { re_dist: { sph: 0 } },
        },
        "admin",
        201,
      )
    ).data;
  // Additional suites and real browser flows are imported below to keep the safety gate centralized.
  const context = {
    root,
    out,
    prisma,
    sql,
    app,
    server,
    base,
    request,
    check,
    results,
    metrics,
    customer,
    frame,
    lens,
    foreignCustomer,
    foreignPurchase,
    admin,
    user,
    password,
    pin,
    jars,
    purchase,
    customerPayload,
    persisted,
  };
  const { runMore } = await import("./audit-crud-more.mjs");
  if (!process.argv.includes("--browser-only") && !process.argv.includes("--edge-only"))
    await runMore(context);
  if (process.argv.includes("--edge-only")) {
    const { runEdge } = await import("./audit-crud-edge.mjs");
    await runEdge(context);
  }
  if (!process.argv.includes("--skip-browser") && !process.argv.includes("--edge-only")) {
    const { runBrowser } = await import("./audit-crud-browser.mjs");
    await runBrowser(context);
  }
} finally {
  // Only the fresh, marked test database reaches this block. Keep cleanup atomic.
  await prisma.$transaction(
    async (tx) => {
      await tx.orderStatusHistory.deleteMany({
        where: { order: { shopId: { in: [shop.id, otherShop.id] } } },
      });
      await tx.order.deleteMany({ where: { shopId: { in: [shop.id, otherShop.id] } } });
      await tx.customerRecord.deleteMany({
        where: { customer: { shopId: { in: [shop.id, otherShop.id] } } },
      });
      await tx.prescription.deleteMany({
        where: { customer: { shopId: { in: [shop.id, otherShop.id] } } },
      });
      await tx.customer.deleteMany({ where: { shopId: { in: [shop.id, otherShop.id] } } });
      await tx.frameCatalog.deleteMany({ where: { shopId: { in: [shop.id, otherShop.id] } } });
      await tx.lensCatalog.deleteMany({ where: { shopId: { in: [shop.id, otherShop.id] } } });
      await tx.shop.deleteMany({ where: { id: { in: [shop.id, otherShop.id] } } });
      await tx.admin.deleteMany({
        where: {
          OR: [{ id: { in: [admin.id, user.id] } }, { username: { startsWith: "audit-created-" } }],
        },
      });
      await tx.accountRateLimit.deleteMany();
    },
    { timeout: 30000 },
  );
  const counts = {
    customers: await prisma.customer.count(),
    purchases: await prisma.customerRecord.count(),
    prescriptions: await prisma.prescription.count(),
    orders: await prisma.order.count(),
    accounts: await prisma.admin.count(),
  };
  assert(
    Object.values(counts).every((n) => n === 0),
    "Synthetic cleanup left records",
  );
  await fs.writeFile(
    path.join(out, "results.json"),
    JSON.stringify(
      {
        target: { host: expectedHost, database: expectedDatabase, branch: "br-red-paper-b4hwnieh" },
        results,
        metrics,
        cleanup: counts,
      },
      null,
      2,
    ),
  );
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
  await sql.end();
  console.log(
    JSON.stringify({
      passed: results.filter((x) => x.status === "PASS").length,
      failed: results.filter((x) => x.status === "FAIL").length,
      cleanup: counts,
    }),
  );
}
process.exitCode = results.some((x) => x.status === "FAIL") ? 1 : 0;
