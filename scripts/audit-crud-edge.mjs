import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

export async function runEdge(c) {
  const {
    check,
    request,
    prisma,
    sql,
    customer,
    purchase,
    customerPayload,
    persisted,
    pin,
    base,
    jars,
    out,
  } = c;
  await check(
    "all purchase types edit independent historical rows with exact totals",
    "PATCH /customers/:id/records/:recordId",
    async () => {
      for (const [name, record, next, total] of [
        [
          "Frame Only",
          purchase("Synthetic Frame", 0),
          purchase("Synthetic Frame Edited", 20.25),
          "20.25",
        ],
        [
          "Lens Only",
          { pricingMode: "SPLIT", lensType: "Synthetic Lens", frameRate: null, lensRate: 10 },
          {
            pricingMode: "SPLIT",
            lensType: "Synthetic Lens Edited",
            frameRate: null,
            lensRate: 30.25,
          },
          "30.25",
        ],
        [
          "Frame + Lens",
          { pricingMode: "SPLIT", specsType: "F", lensType: "L", frameRate: 10, lensRate: 20 },
          {
            pricingMode: "SPLIT",
            specsType: "F2",
            lensType: "L2",
            frameRate: 20.1,
            lensRate: 30.2,
          },
          "50.3",
        ],
        [
          "MRP_ONLY",
          { pricingMode: "MRP_ONLY", specsType: "Synthetic MRP", mrp: 10 },
          { pricingMode: "MRP_ONLY", specsType: "Synthetic MRP Edited", mrp: 40.25 },
          "40.25",
        ],
      ]) {
        const row = (
          await request("/customers/" + customer.id + "/records", "POST", { record }, "admin", 201)
        ).data;
        const others = await prisma.customerRecord.findMany({
          where: { customerId: customer.id, id: { not: row.id } },
          orderBy: { id: "asc" },
        });
        await request("/customers/" + customer.id + "/records/" + row.id, "PATCH", {
          record: next,
          purchaseDate: "2020-02-29",
        });
        const saved = await prisma.customerRecord.findUniqueOrThrow({ where: { id: row.id } });
        assert.equal(saved.mrp.toString(), total, name);
        assert.equal(saved.purchaseDate.toISOString().slice(0, 10), "2020-02-29");
        assert.deepEqual(
          await prisma.customerRecord.findMany({
            where: { customerId: customer.id, id: { not: row.id } },
            orderBy: { id: "asc" },
          }),
          others,
        );
        assert.equal(
          (await persisted(customer.id)).records.find((x) => x.id === row.id).mrp,
          total,
        );
      }
    },
  );
  await check(
    "permanent purchase deletion removes exclusive prescription and retains shared prescription",
    "DELETE /customers/:id/records/:recordId/permanent",
    async () => {
      for (const shared of [false, true]) {
        const row = (
          await request(
            "/customers/" + customer.id + "/records",
            "POST",
            {
              record: purchase("Synthetic Disposable Purchase"),
              prescription: { re_dist: { sph: 0 } },
            },
            "admin",
            201,
          )
        ).data;
        if (shared)
          await request(
            "/customers/" + customer.id + "/records",
            "POST",
            { record: purchase("Synthetic Shared Reference"), prescriptionId: row.prescriptionId },
            "admin",
            201,
          );
        await request("/customers/" + customer.id + "/records/" + row.id, "DELETE");
        await request("/customers/" + customer.id + "/records/" + row.id + "/permanent", "DELETE", {
          pin,
        });
        assert.equal(await prisma.customerRecord.count({ where: { id: row.id } }), 0);
        assert.equal(
          await prisma.prescription.count({ where: { id: row.prescriptionId } }),
          shared ? 1 : 0,
        );
        assert(await prisma.customer.findUnique({ where: { id: customer.id } }));
      }
    },
  );
  await check(
    "concurrent delete and restore keep parent and owned deletion groups consistent",
    "DELETE /customers/:id; POST /customers/:id/restore",
    async () => {
      const row = (
        await request(
          "/customers",
          "POST",
          {
            ...customerPayload("Synthetic Concurrent Trash"),
            prescription: { re_dist: { sph: 0 } },
          },
          "admin",
          201,
        )
      ).data;
      const headers = {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: [...jars.admin].map(([k, v]) => k + "=" + v).join("; "),
      };
      const responses = await Promise.all([
        fetch(base + "/api/customers/" + row.id, { method: "DELETE", headers }),
        fetch(base + "/api/customers/" + row.id + "/restore", { method: "POST", headers }),
      ]);
      assert(responses.every((r) => [200, 409].includes(r.status)));
      const saved = await prisma.customer.findUniqueOrThrow({
        where: { id: row.id },
        include: { records: true, prescriptions: true },
      });
      for (const child of [...saved.records, ...saved.prescriptions]) {
        assert.equal(Boolean(child.deletedAt), Boolean(saved.deletedAt));
        assert.equal(child.deletionGroupId, saved.deletionGroupId);
      }
    },
  );
  await check(
    "database serialization failure returns retryable conflict and preserves intended fields",
    "PATCH /customers/:id",
    async () => {
      // A test-only trigger produces a real PostgreSQL serialization exception.
      await sql.query(
        `CREATE FUNCTION audit_fail_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='synthetic serialization failure'; END $$`,
      );
      await sql.query(
        'CREATE TRIGGER audit_fail_update BEFORE UPDATE ON "Customer" FOR EACH ROW EXECUTE FUNCTION audit_fail_update()',
      );
      const before = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
      try {
        await request(
          "/customers/" + customer.id,
          "PATCH",
          { name: "Synthetic Recovered" },
          "admin",
          409,
        );
      } finally {
        await sql.query('DROP TRIGGER audit_fail_update ON "Customer"');
        await sql.query("DROP FUNCTION audit_fail_update()");
      }
      assert.equal(
        (await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).name,
        before.name,
      );
      await request("/customers/" + customer.id, "PATCH", { name: "Synthetic Recovered" });
      assert.equal((await persisted(customer.id)).name, "Synthetic Recovered");
    },
  );
  await check(
    "independent yearly/monthly sums and representative query plans",
    "GET /dashboard; GET /analytics/purchases",
    async () => {
      const db = (
        await sql.query(
          'SELECT EXTRACT(YEAR FROM r."purchaseDate")::int AS year, EXTRACT(MONTH FROM r."purchaseDate")::int AS month, SUM(r.mrp)::text AS value, COUNT(*)::int AS purchases FROM "CustomerRecord" r JOIN "Customer" c ON c.id=r."customerId" WHERE c."shopId"=$1 AND c."isActive" AND c."deletedAt" IS NULL AND r."deletedAt" IS NULL AND r."deletionGroupId" IS NULL AND r."purchaseDate"<=CURRENT_DATE GROUP BY 1,2',
          [customer.shopId],
        )
      ).rows;
      const dashboard = (await request("/dashboard")).data;
      for (const group of db) {
        const year = dashboard.years.find((x) => x.year === group.year);
        assert(year);
        const month = year.months.find((x) => x.month === group.month);
        assert.equal(Math.round(month.value * 100), Math.round(Number(group.value) * 100));
        assert.equal(month.purchases, group.purchases);
      }
      const plan = await sql.query(
        'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id,name FROM "Customer" WHERE "shopId"=$1 AND "isActive" AND "deletedAt" IS NULL AND name ILIKE $2 LIMIT 50',
        [customer.shopId, "%Synthetic%"],
      );
      await fs.writeFile(path.join(out, "query-plan.json"), JSON.stringify(plan.rows, null, 2));
      const orphans = (
        await sql.query(
          'SELECT count(*)::int AS count FROM "CustomerRecord" r LEFT JOIN "Customer" c ON c.id=r."customerId" LEFT JOIN "Prescription" p ON p.id=r."prescriptionId" WHERE c.id IS NULL OR (r."prescriptionId" IS NOT NULL AND (p.id IS NULL OR p."customerId"<>r."customerId"))',
        )
      ).rows[0].count;
      assert.equal(orphans, 0);
    },
  );
}
