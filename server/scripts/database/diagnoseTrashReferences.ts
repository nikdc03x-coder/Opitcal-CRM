import "dotenv/config";
import { Client } from "pg";

// Read-only diagnostics: schema metadata and aggregate counts only. No customer data or credentials.
async function main() {
  const db = new Client({
    connectionString: process.env.DIRECT_URL,
    connectionTimeoutMillis: 15000,
  });
  await db.connect();
  try {
    await db.query("BEGIN READ ONLY");
    const references = await db.query(`
      SELECT con.conname AS constraint, ns.nspname AS schema, child.relname AS child,
        parent.relname AS parent, cardinality(con.conkey) AS columns,
        ARRAY(SELECT a.attname FROM unnest(con.conkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=child.oid AND a.attnum=k.num ORDER BY k.ord) AS child_columns,
        ARRAY(SELECT a.attname FROM unnest(con.confkey) WITH ORDINALITY k(num,ord)
          JOIN pg_attribute a ON a.attrelid=parent.oid AND a.attnum=k.num ORDER BY k.ord) AS parent_columns
      FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid
      JOIN pg_namespace ns ON ns.oid=child.relnamespace JOIN pg_class parent ON parent.oid=con.confrelid
      JOIN pg_namespace pns ON pns.oid=parent.relnamespace
      WHERE con.contype='f' AND pns.nspname='public'
        AND parent.relname IN ('Customer','CustomerRecord','Prescription','Order','OrderStatusHistory','CustomerNoteVersion')
      ORDER BY parent.relname,child.relname,con.conname
    `);
    const optional = await db.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('RecordAudit','StockMovement','ImportRow','MutationReceipt')
      AND column_name IN ('customerId','recordId','purchaseRecordId','entityId','response') ORDER BY 1,2`);
    const counts = await db.query(`SELECT
      (SELECT count(*)::int FROM "Customer" WHERE "deletedAt" IS NOT NULL) AS trashed_customers,
      (SELECT count(*)::int FROM "CustomerRecord" WHERE "deletedAt" IS NOT NULL) AS trashed_purchases`);
    const blockers: Record<string, number> = {};
    for (const row of references.rows) {
      if (row.parent !== "CustomerRecord" || row.columns !== 1) continue;
      const columns = String(row.child_columns).slice(1, -1).split(",");
      const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
      const result =
        await db.query(`SELECT count(*)::int AS n FROM ${quote(row.schema)}.${quote(row.child)} child
        JOIN "CustomerRecord" purchase ON child.${quote(columns[0])}=purchase.id WHERE purchase."deletedAt" IS NOT NULL`);
      blockers[row.child] = result.rows[0].n;
    }
    if (
      optional.rows.some(
        (row) => row.table_name === "RecordAudit" && row.column_name === "entityId",
      )
    ) {
      blockers.RecordAudit = (
        await db.query(
          `SELECT count(*)::int AS n FROM "RecordAudit" a JOIN "CustomerRecord" r ON a."entityId"=r.id WHERE r."deletedAt" IS NOT NULL`,
        )
      ).rows[0].n;
    }
    if (
      optional.rows.some(
        (row) => row.table_name === "MutationReceipt" && row.column_name === "response",
      )
    ) {
      blockers.MutationReceipt = (
        await db.query(
          `SELECT count(*)::int AS n FROM "MutationReceipt" m WHERE EXISTS(SELECT 1 FROM "CustomerRecord" r WHERE r."deletedAt" IS NOT NULL AND strpos(m.response::text,r.id)>0)`,
        )
      ).rows[0].n;
    }
    console.log(
      JSON.stringify(
        {
          references: references.rows,
          retainedReferenceColumns: optional.rows,
          counts: counts.rows[0],
          trashedPurchaseReferenceCounts: blockers,
        },
        null,
        2,
      ),
    );
    await db.query("ROLLBACK");
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error("Read-only Trash diagnostics failed; no database data was changed.");
  process.exitCode = 1;
});
