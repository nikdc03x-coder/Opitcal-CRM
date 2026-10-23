import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

export async function runMore(c) {
  const {
    prisma,
    sql,
    request,
    check,
    customer,
    frame,
    lens,
    foreignCustomer,
    foreignPurchase,
    admin,
    user,
    password,
    pin,
    purchase,
    customerPayload,
    persisted,
    base,
    jars,
    root,
  } = c;
  let order;
  await check(
    "orders create, duplicate rejection, delivery update and status history",
    "/orders; /orders/:id/status",
    async () => {
      order = (
        await request(
          "/orders",
          "POST",
          {
            customerId: customer.id,
            purchaseRecordId: customer.records[0].id,
            expectedDeliveryDate: "2026-10-01",
            internalNotes: "Synthetic internal note",
          },
          "admin",
          201,
        )
      ).data;
      assert(order?.id);
      await request(
        "/orders",
        "POST",
        { customerId: customer.id, purchaseRecordId: customer.records[0].id },
        "admin",
        409,
      );
      await request("/orders/" + order.id, "PATCH", {
        expectedDeliveryDate: "2026-10-25",
        internalNotes: "Updated synthetic note",
      });
      let row = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(row.internalNotes, "Updated synthetic note");
      assert.equal(row.expectedDeliveryDate.toISOString().slice(0, 10), "2026-10-25");
      for (const [from, to] of [
        ["PLACED", "PROCESSING"],
        ["PROCESSING", "READY"],
        ["READY", "DELIVERED"],
      ])
        await request("/orders/" + order.id + "/status", "PATCH", {
          status: to,
          expectedStatus: from,
          note: "Synthetic " + to,
        });
      row = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { history: true },
      });
      assert.equal(row.history.length, 4);
      assert(row.deliveredAt);
      assert.equal((await request("/orders/" + order.id)).data.status, "DELIVERED");
      await request(
        "/orders/" + order.id + "/status",
        "PATCH",
        { status: "PROCESSING", expectedStatus: "PLACED" },
        "admin",
        409,
      );
      await request(
        "/orders",
        "POST",
        { customerId: customer.id, purchaseRecordId: foreignPurchase.id },
        "admin",
        400,
      );
    },
  );
  await check(
    "order cancellation and concurrent status update have one history winner",
    "/orders/:id/status",
    async () => {
      const rec = (await persisted(customer.id)).records.find(
        (x) => x.id !== customer.records[0].id,
      );
      const o = (
        await request(
          "/orders",
          "POST",
          { customerId: customer.id, purchaseRecordId: rec.id },
          "admin",
          201,
        )
      ).data;
      const responses = await Promise.all([
        fetch(base + "/api/orders/" + o.id + "/status", {
          method: "PATCH",
          headers: {
            Origin: base,
            "Content-Type": "application/json",
            Cookie: [...jars.admin].map(([k, v]) => k + "=" + v).join("; "),
          },
          body: JSON.stringify({ status: "PROCESSING", expectedStatus: "PLACED" }),
        }),
        fetch(base + "/api/orders/" + o.id + "/status", {
          method: "PATCH",
          headers: {
            Origin: base,
            "Content-Type": "application/json",
            Cookie: [...jars.admin].map(([k, v]) => k + "=" + v).join("; "),
          },
          body: JSON.stringify({ status: "CANCELLED", expectedStatus: "PLACED" }),
        }),
      ]);
      assert.deepEqual(responses.map((x) => x.status).sort(), [200, 409]);
      assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: o.id } }), 2);
      const row = await prisma.order.findUniqueOrThrow({ where: { id: o.id } });
      if (row.status !== "CANCELLED")
        await request("/orders/" + o.id + "/status", "PATCH", {
          status: "CANCELLED",
          expectedStatus: row.status,
        });
      assert((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).cancelledAt);
      await request(
        "/orders/" + o.id,
        "PATCH",
        { internalNotes: "No longer editable" },
        "admin",
        409,
      );
    },
  );
  await check(
    "analytics totals/month/year/mix/CSV match independent database sums",
    "/analytics/*; /dashboard",
    async () => {
      const shopId = customer.shopId;
      const rows = (
        await sql.query(
          'SELECT r.* FROM "CustomerRecord" r JOIN "Customer" c ON c.id=r."customerId" WHERE c."shopId"=$1 AND c."isActive" AND c."deletedAt" IS NULL AND r."deletedAt" IS NULL AND r."deletionGroupId" IS NULL',
          [shopId],
        )
      ).rows;
      const sum = rows.reduce((n, r) => n + Math.round(Number(r.mrp) * 100), 0);
      const overview = (await request("/analytics/overview?period=all")).data;
      assert.equal(overview.summary.purchases, rows.length);
      assert.equal(Math.round(Number(overview.summary.value) * 100), sum);
      assert.equal(
        overview.activeCustomers,
        await prisma.customer.count({ where: { shopId, isActive: true, deletedAt: null } }),
      );
      const paged = (await request("/analytics/purchases?period=all&pageSize=2")).data;
      assert.equal(paged.rows.length, 2);
      assert.equal(paged.total, rows.length);
      for (const route of ["customers", "mix", "frames", "lenses", "historical"])
        await request("/analytics/" + route + "?period=all");
      await request("/analytics/comparison?period=year");
      const filtered = (
        await request("/analytics/purchases?period=custom&from=2026-10-01&to=2026-10-31")
      ).data;
      const month = rows.filter(
        (x) => x.purchaseDate && x.purchaseDate.toISOString().startsWith("2026-10"),
      );
      assert.equal(filtered.summary.purchases, month.length);
      assert.equal(
        Math.round(Number(filtered.summary.value) * 100),
        month.reduce((n, r) => n + Math.round(Number(r.mrp) * 100), 0),
      );
      const dashboard = (await request("/dashboard")).data;
      assert.equal(dashboard.totalCustomers, overview.activeCustomers);
      const csv = (await request("/analytics/purchases.csv?period=all")).text;
      assert(csv);
      assert(!csv.includes("Updated private note"));
      assert(!csv.includes("Synthetic Foreign"));
      assert(csv.includes("500.50"));
      await request(
        "/analytics/overview?from=2026-02-30&to=2026-03-01&period=custom",
        "GET",
        undefined,
        "admin",
        400,
      );
    },
  );
  await check(
    "soft delete and restore preserve older trash, shared prescriptions and unrelated customers",
    "/customers/:id/{restore,records/:id/restore}; /customers/trash",
    async () => {
      const row = (
        await request(
          "/customers",
          "POST",
          { ...customerPayload("Synthetic Trash"), prescription: { re_dist: { sph: 0 } } },
          "admin",
          201,
        )
      ).data;
      const first = row.records[0],
        rx = row.prescriptions[0];
      const second = (
        await request(
          "/customers/" + row.id + "/records",
          "POST",
          { record: purchase("Shared"), prescriptionId: rx.id },
          "admin",
          201,
        )
      ).data;
      await request("/customers/" + row.id + "/records/" + first.id, "DELETE");
      assert.equal(
        (await prisma.prescription.findUniqueOrThrow({ where: { id: rx.id } })).deletedAt,
        null,
      );
      await request("/customers/" + row.id, "DELETE");
      await request("/customers/" + row.id, "GET", undefined, "admin", 404);
      assert(
        !(await request("/customers?name=Synthetic%20Trash")).data.some((x) => x.id === row.id),
      );
      assert((await request("/customers/trash")).data.customers.some((x) => x.id === row.id));
      await request("/customers/" + row.id + "/restore", "POST");
      assert(
        (await prisma.customerRecord.findUniqueOrThrow({ where: { id: first.id } })).deletedAt,
      );
      assert.equal(
        (await prisma.customerRecord.findUniqueOrThrow({ where: { id: second.id } })).deletedAt,
        null,
      );
      await request("/customers/" + row.id + "/records/" + first.id + "/restore", "POST");
      assert.equal((await persisted(row.id)).records.length, 2);
      assert.equal(
        (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).deletedAt,
        null,
      );
    },
  );
  await check(
    "permanent deletion rejects active records, wrong PINs and missing PINs",
    "/customers/:id/permanent",
    async () => {
      await request("/customers/" + customer.id + "/permanent", "DELETE", { pin }, "admin", 409);
      await request(
        "/customers/" + customer.id + "/permanent",
        "DELETE",
        { pin: pin === "0000" ? "1111" : "0000" },
        "admin",
        403,
      );
      await request("/customers/" + customer.id + "/permanent", "DELETE", {}, "admin", 400);
      assert(await prisma.customer.findUnique({ where: { id: customer.id } }));
      assert.equal(
        (await prisma.adminDeletionPin.findUniqueOrThrow({ where: { adminId: admin.id } }))
          .failedAttempts,
        1,
      );
    },
  );
  await check(
    "permanent deletion is administrator-only even when a staff account has a PIN",
    "/customers/:id/permanent",
    async () => {
      // A former admin may retain a PIN after demotion. Role checks must still deny it.
      const require = createRequire(path.join(root, "server/package.json"));
      await require(path.join(root, "server/dist/services/deletionPinService.js")).setDeletionPin(
        user.id,
        pin,
      );
      const row = (
        await request("/customers", "POST", customerPayload("Synthetic Staff Denial"), "admin", 201)
      ).data;
      await request("/customers/" + row.id, "DELETE");
      await request("/customers/" + row.id + "/permanent", "DELETE", { pin }, "user", 403);
      assert(await prisma.customer.findUnique({ where: { id: row.id } }));
    },
  );
  await check(
    "PIN lockout persists and a correct PIN cannot bypass the lock",
    "/customers/:id/permanent",
    async () => {
      const wrong = pin === "0000" ? "1111" : "0000";
      await prisma.adminDeletionPin.update({
        where: { adminId: admin.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
      for (let i = 0; i < 5; i++)
        await request(
          "/customers/" + customer.id + "/permanent",
          "DELETE",
          { pin: wrong },
          "admin",
          i === 4 ? 429 : 403,
        );
      await request("/customers/" + customer.id + "/permanent", "DELETE", { pin }, "admin", 429);
      const row = await prisma.adminDeletionPin.findUniqueOrThrow({ where: { adminId: admin.id } });
      assert.equal(row.failedAttempts, 5);
      assert(row.lockedUntil > new Date());
      // Fault-control reset affects only this synthetic account.
      await prisma.adminDeletionPin.update({
        where: { adminId: admin.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    },
  );
  await check(
    "permanent delete transaction rolls back on a database failure; then removes only disposable data",
    "/customers/:id/permanent",
    async () => {
      const row = (
        await request(
          "/customers",
          "POST",
          { ...customerPayload("Synthetic Disposable"), prescription: { re_dist: { sph: 1 } } },
          "admin",
          201,
        )
      ).data;
      await request("/customers/" + row.id, "DELETE");
      await sql.query(
        `CREATE FUNCTION audit_fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic injected failure'; END $$`,
      );
      await sql.query(
        'CREATE TRIGGER audit_fail_delete BEFORE DELETE ON "Customer" FOR EACH ROW EXECUTE FUNCTION audit_fail_delete()',
      );
      try {
        await request("/customers/" + row.id + "/permanent", "DELETE", { pin }, "admin", 500);
      } finally {
        await sql.query('DROP TRIGGER audit_fail_delete ON "Customer"');
        await sql.query("DROP FUNCTION audit_fail_delete()");
      }
      assert(await prisma.customer.findUnique({ where: { id: row.id } }));
      assert.equal(await prisma.customerRecord.count({ where: { customerId: row.id } }), 1);
      assert.equal(await prisma.prescription.count({ where: { customerId: row.id } }), 1);
      await request("/customers/" + row.id + "/permanent", "DELETE", { pin });
      assert.equal(await prisma.customer.count({ where: { id: row.id } }), 0);
      assert.equal(await prisma.customerRecord.count({ where: { customerId: row.id } }), 0);
      assert.equal(await prisma.prescription.count({ where: { customerId: row.id } }), 0);
      assert(await prisma.customer.findUnique({ where: { id: customer.id } }));
    },
  );
  await check(
    "retained financial foreign key prevents permanent deletion",
    "/customers/:id/permanent",
    async () => {
      const row = (
        await request("/customers", "POST", customerPayload("Synthetic Retained"), "admin", 201)
      ).data;
      await request("/customers/" + row.id, "DELETE");
      await sql.query(
        'CREATE TABLE audit_financial_reference (id text PRIMARY KEY,"customerId" text REFERENCES "Customer"(id))',
      );
      await sql.query("INSERT INTO audit_financial_reference VALUES ($1,$2)", [
        "synthetic-finance",
        row.id,
      ]);
      try {
        await request("/customers/" + row.id + "/permanent", "DELETE", { pin }, "admin", 409);
        assert(await prisma.customer.findUnique({ where: { id: row.id } }));
      } finally {
        await sql.query("DROP TABLE audit_financial_reference");
      }
    },
  );
  await check(
    "catalog deletion preserves historical purchase snapshot and clears foreign key",
    "/catalog/{frames,lenses}/:id",
    async () => {
      const row = (
        await request(
          "/customers",
          "POST",
          {
            ...customerPayload("Synthetic Catalog History"),
            record: { pricingMode: "MRP_ONLY", lensCatalogId: lens.id, mrp: 80 },
          },
          "admin",
          201,
        )
      ).data;
      const before = await prisma.customerRecord.findUniqueOrThrow({
        where: { id: row.records[0].id },
      });
      await request("/catalog/lenses/" + lens.id, "DELETE");
      const after = await prisma.customerRecord.findUniqueOrThrow({ where: { id: before.id } });
      assert.equal(after.lensType, before.lensType);
      assert.equal(after.mrp.toString(), before.mrp.toString());
      assert.equal(after.lensCatalogId, null);
      await request("/catalog/frames/" + frame.id, "DELETE");
      assert.equal(await prisma.frameCatalog.count({ where: { id: frame.id } }), 0);
    },
  );
  await check(
    "order delete removes status history and preserves customer purchase",
    "/orders/:id",
    async () => {
      await request("/orders/" + order.id, "DELETE");
      assert.equal(await prisma.orderStatusHistory.count({ where: { orderId: order.id } }), 0);
      assert(await prisma.customerRecord.findUnique({ where: { id: customer.records[0].id } }));
      await request("/orders/" + order.id, "GET", undefined, "admin", 404);
    },
  );
  await check(
    "authentication, role permissions and untrusted writes fail closed",
    "/settings/users; /customers; /orders",
    async () => {
      for (const route of [
        "/customers",
        "/customers/trash",
        "/catalog/frames",
        "/orders",
        "/analytics/overview",
        "/settings/me",
      ])
        await request(route, "GET", undefined, "guest", 401);
      await request("/settings/users", "GET", undefined, "user", 403);
      await request("/settings/users", "POST", { username: "hijack" }, "user", 403);
      const response = await fetch(base + "/api/customers/" + customer.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Hijack" }),
      });
      assert.equal(response.status, 403);
      const users = (await request("/settings/users")).users;
      assert(users.every((x) => !("passwordHash" in x)));
      assert.equal(users.length, 2);
    },
  );
  await check(
    "profile password verification and persisted account update",
    "/settings/me",
    async () => {
      await request(
        "/settings/me",
        "PATCH",
        {
          name: "Synthetic Updated Admin",
          email: "updated@example.test",
          currentPassword: "wrong-password",
        },
        "admin",
        403,
      );
      await request("/settings/me", "PATCH", {
        name: "Synthetic Updated Admin",
        email: "updated@example.test",
        currentPassword: password,
      });
      const row = await prisma.admin.findUniqueOrThrow({ where: { id: admin.id } });
      assert.equal(row.name, "Synthetic Updated Admin");
      assert.equal(row.email, "updated@example.test");
      assert.equal((await request("/settings/me")).account.name, row.name);
    },
  );
  await check(
    "invited account creation, password setup/reset, password change and session invalidation",
    "/settings/users; /auth/reset-password; /settings/me/password",
    async () => {
      const require = createRequire(path.join(root, "server/package.json"));
      const nodemailer = require("nodemailer");
      const original = nodemailer.createTransport;
      const savedEnv = {
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
      };
      const delivered = [];
      process.env.SMTP_HOST = "smtp.example.test";
      process.env.SMTP_USER = "sender@example.test";
      process.env.SMTP_PASS = "synthetic-test-password";
      nodemailer.createTransport = () => ({
        sendMail: async (message) => {
          delivered.push(message.text.match(/reset-password#([a-f0-9]{64})/)[1]);
          return { accepted: message.to, rejected: [] };
        },
        close() {},
      });
      try {
        const created = (
          await request(
            "/settings/users",
            "POST",
            {
              username: "audit-created-" + Date.now(),
              name: "Synthetic Invited Staff",
              email: "invited@example.test",
              role: "USER",
              isActive: true,
            },
            "admin",
            201,
          )
        ).user;
        assert.equal(
          (await prisma.admin.findUniqueOrThrow({ where: { id: created.id } })).role,
          "USER",
        );
        assert.equal(delivered.length, 1);
        const token = delivered[0],
          nextPassword = password + "-new";
        await request("/auth/reset-password/verify", "POST", { token }, "guest");
        await request(
          "/auth/reset-password",
          "POST",
          { token, newPassword: password, confirmation: password },
          "guest",
        );
        assert.equal(await prisma.passwordResetToken.count({ where: { adminId: created.id } }), 0);
        await request(
          "/auth/reset-password",
          "POST",
          { token, newPassword: nextPassword, confirmation: nextPassword },
          "guest",
          400,
        );
        jars.created = new Map();
        await request("/auth/login", "POST", { username: created.username, password }, "created");
        await request(
          "/settings/me/password",
          "POST",
          { currentPassword: password, newPassword: nextPassword, confirmation: nextPassword },
          "created",
        );
        assert.equal(await prisma.adminSession.count({ where: { adminId: created.id } }), 0);
        await request("/settings/me", "GET", undefined, "created", 401);
        await request(
          "/auth/login",
          "POST",
          { username: created.username, password: nextPassword },
          "created",
        );
        await request("/auth/forgot-password", "POST", { email: "invited@example.test" }, "guest");
        assert.equal(delivered.length, 2);
        const reset = delivered[1];
        await request(
          "/auth/reset-password",
          "POST",
          { token: reset, newPassword: password, confirmation: password },
          "guest",
        );
        assert.equal(await prisma.adminSession.count({ where: { adminId: created.id } }), 0);
        assert.equal(await prisma.passwordResetToken.count({ where: { adminId: created.id } }), 0);
      } finally {
        nodemailer.createTransport = original;
        Object.assign(process.env, savedEnv);
      }
    },
  );
  await check(
    "staff deactivation invalidates sessions and prevents login",
    "/settings/users/:id; /auth/login",
    async () => {
      await request("/settings/users/" + user.id, "PATCH", {
        username: user.username,
        name: user.name,
        email: user.email,
        role: "USER",
        isActive: false,
      });
      assert.equal(
        (await prisma.admin.findUniqueOrThrow({ where: { id: user.id } })).isActive,
        false,
      );
      assert.equal(await prisma.adminSession.count({ where: { adminId: user.id } }), 0);
      await request("/settings/me", "GET", undefined, "user", 401);
      await request("/auth/login", "POST", { username: user.username, password }, "user", 401);
      await request(
        "/settings/users/" + admin.id,
        "PATCH",
        {
          username: admin.username,
          name: "Synthetic Updated Admin",
          email: "updated@example.test",
          role: "USER",
          isActive: true,
        },
        "admin",
        409,
      );
    },
  );
  await check(
    "customer creation rollback leaves no partial parent or prescription",
    "/customers",
    async () => {
      await sql.query(
        `CREATE FUNCTION audit_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic injected failure'; END $$`,
      );
      await sql.query(
        'CREATE TRIGGER audit_fail_insert BEFORE INSERT ON "CustomerRecord" FOR EACH ROW EXECUTE FUNCTION audit_fail_insert()',
      );
      try {
        await request(
          "/customers",
          "POST",
          { ...customerPayload("Synthetic Rollback"), prescription: { re_dist: { sph: 1 } } },
          "admin",
          500,
        );
      } finally {
        await sql.query('DROP TRIGGER audit_fail_insert ON "CustomerRecord"');
        await sql.query("DROP FUNCTION audit_fail_insert()");
      }
      assert.equal(await prisma.customer.count({ where: { name: "Synthetic Rollback" } }), 0);
      const orphans = (
        await sql.query(
          'SELECT count(*)::int AS n FROM "Prescription" p LEFT JOIN "Customer" c ON c.id=p."customerId" WHERE c.id IS NULL',
        )
      ).rows[0].n;
      assert.equal(orphans, 0);
    },
  );
  await check(
    "simultaneous creates are independent; concurrent purchase updates stay consistent",
    "/customers; /customers/:id/records/:id",
    async () => {
      const rows = await Promise.all([
        request("/customers", "POST", customerPayload("Synthetic Simultaneous"), "admin", 201),
        request("/customers", "POST", customerPayload("Synthetic Simultaneous"), "admin", 201),
      ]);
      assert.notEqual(rows[0].data.id, rows[1].data.id); // No idempotency contract: two explicit requests create two customers.
      assert.equal(await prisma.customer.count({ where: { name: "Synthetic Simultaneous" } }), 2);
      await Promise.all([
        request("/customers/" + customer.id + "/records/" + customer.records[0].id, "PATCH", {
          record: purchase("Synthetic Concurrent A", 10),
          purchaseDate: null,
        }),
        request("/customers/" + customer.id + "/records/" + customer.records[0].id, "PATCH", {
          record: purchase("Synthetic Concurrent B", 20),
          purchaseDate: null,
        }),
      ]);
      const row = await prisma.customerRecord.findUniqueOrThrow({
        where: { id: customer.records[0].id },
      });
      assert(["Synthetic Concurrent A", "Synthetic Concurrent B"].includes(row.specsType));
      assert.equal(row.mrp.toString(), row.frameRate.toString());
    },
  );
  await check(
    "bounded normal-workload performance with 200 synthetic customers",
    "/customers; /orders; /analytics",
    async () => {
      await prisma.customer.createMany({
        data: Array.from({ length: 200 }, (_, i) => ({
          shopId: customer.shopId,
          name: "Synthetic Perf " + String(i).padStart(3, "0"),
        })),
      });
      const rows = await request("/customers?name=Synthetic%20Perf");
      assert.equal(rows.data.length, 50);
      await persisted(customer.id);
      await request("/catalog/frames?search=Synthetic");
      await request("/orders?pageSize=20");
      await request("/analytics/overview?period=all");
      // Timings/query counts are recorded, not asserted against arbitrary latency thresholds.
    },
  );
}
