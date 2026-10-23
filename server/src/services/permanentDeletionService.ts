import { prisma } from "../config/database";
import { Prisma } from "../generated/prisma/client";
import { getShopId } from "./shopService";
import { HttpError } from "../utils/errors";

type Plan = Record<string, string[]>;
type Reference = {
  childSchema: string;
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
  columns: number;
};
const retained = (kind = "financial, inventory, audit or unsupported") =>
  new HttpError(
    `This record has retained ${kind} references. Permanent deletion is blocked to preserve that history; the record remains in Trash and can be restored.`,
    409,
  );
// Identifiers come only from PostgreSQL catalogs and this module, never request input.
const identifier = (value: string) => Prisma.raw(`"${value.replace(/"/g, '""')}"`);

async function checkReferences(tx: Prisma.TransactionClient, plan: Plan) {
  const tables = Object.keys(plan).filter((table) => plan[table].length);
  const references = await tx.$queryRaw<Reference[]>(Prisma.sql`
    SELECT ns.nspname AS "childSchema", child.relname AS "childTable", ca.attname AS "childColumn",
      parent.relname AS "parentTable", pa.attname AS "parentColumn", cardinality(con.conkey) AS columns
    FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid
    JOIN pg_namespace ns ON ns.oid=child.relnamespace
    JOIN pg_class parent ON parent.oid=con.confrelid
    JOIN pg_namespace pns ON pns.oid=parent.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=child.oid AND ca.attnum=con.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid=parent.oid AND pa.attnum=con.confkey[1]
    WHERE con.contype='f' AND pns.nspname='public' AND parent.relname IN (${Prisma.join(tables)})
  `);
  for (const ref of references) {
    if (ref.columns !== 1 || ref.parentColumn !== "id") throw retained();
    const owned = ref.childSchema === "public" ? plan[ref.childTable] : undefined;
    const [result] = await tx.$queryRaw<{ found: boolean }[]>(Prisma.sql`
      SELECT EXISTS(SELECT 1 FROM ${identifier(ref.childSchema)}.${identifier(ref.childTable)}
        WHERE ${identifier(ref.childColumn)} IN (${Prisma.join(plan[ref.parentTable])})
        ${owned?.length ? Prisma.sql`AND id NOT IN (${Prisma.join(owned)})` : Prisma.empty}) AS found
    `);
    if (result?.found)
      throw retained(
        ref.childTable === "LedgerEntry"
          ? "financial ledger"
          : ref.childTable === "StockMovement" || ref.childTable === "PurchaseItem"
            ? "inventory"
            : "financial, inventory, audit or unsupported",
      );
  }
  // Existing audit snapshots and inventory references are intentionally not erased.
  // These installations may keep references without a foreign-key constraint.
  const optional = await tx.$queryRaw<{ table: string; column: string }[]>`
    SELECT table_name AS "table", column_name AS "column" FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('RecordAudit','StockMovement','ImportRow','MutationReceipt')
      AND column_name IN ('customerId','recordId','purchaseRecordId','entityId','response')
  `;
  const allIds = Object.values(plan).flat();
  for (const ref of optional) {
    const [result] = await tx.$queryRaw<{ found: boolean }[]>(Prisma.sql`
      SELECT EXISTS(SELECT 1 FROM public.${identifier(ref.table)}
        WHERE ${
          ref.column === "response"
            ? Prisma.sql`EXISTS(SELECT 1 FROM unnest(ARRAY[${Prisma.join(allIds)}]::text[]) AS target(id) WHERE strpos(${identifier(ref.column)}::text, target.id) > 0)`
            : Prisma.sql`${identifier(ref.column)}::text IN (${Prisma.join(allIds)})`
        }) AS found
    `);
    if (result?.found)
      throw retained(
        ref.table === "RecordAudit"
          ? "audit history"
          : ref.table === "MutationReceipt"
            ? "saved operation receipt"
            : "inventory or import history",
      );
  }
}

// This service is called only after requireAdmin and backend PIN verification.
export async function permanentlyDeleteData(customerId: string, purchaseId?: string) {
  const shopId = await getShopId();
  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, shopId } });
      if (!customer) throw new HttpError("Customer not found.", 404);
      if (!purchaseId && !customer.deletedAt)
        throw new HttpError("Only customers already in Trash can be permanently deleted.", 409);
      const records = await tx.customerRecord.findMany({
        where: { customerId, ...(purchaseId ? { id: purchaseId } : {}) },
        select: { id: true, deletedAt: true, prescriptionId: true },
      });
      if (purchaseId && !records.length)
        throw new HttpError("Purchase not found for this customer.", 404);
      if (records.some((row) => !row.deletedAt))
        throw new HttpError("Only purchases already in Trash can be permanently deleted.", 409);
      const purchases = records.map((row) => row.id);
      const prescriptions = await tx.prescription.findMany({
        where: {
          customerId,
          ...(purchaseId
            ? {
                id: records[0].prescriptionId ?? "",
                createdForPurchaseId: purchaseId,
                deletedAt: { not: null },
                records: { none: { id: { not: purchaseId } } },
              }
            : {}),
        },
        select: { id: true, deletedAt: true },
      });
      if (prescriptions.some((row) => !row.deletedAt))
        throw new HttpError("An active prescription prevents permanent customer deletion.", 409);
      const orders = await tx.order.findMany({
        where: { ...(purchaseId ? { purchaseRecordId: purchaseId } : { customerId }), shopId },
        select: { id: true },
      });
      const history = orders.length
        ? await tx.orderStatusHistory.findMany({
            where: { orderId: { in: orders.map((row) => row.id) } },
            select: { id: true },
          })
        : [];
      const noteTable = !purchaseId
        ? await tx.$queryRaw<
            { present: boolean }[]
          >`SELECT to_regclass('public."CustomerNoteVersion"') IS NOT NULL AS present`
        : [];
      const notes = noteTable[0]?.present
        ? await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "CustomerNoteVersion" WHERE "customerId" = ${customerId}`
        : [];
      const plan: Plan = {
        Customer: purchaseId ? [] : [customerId],
        CustomerRecord: purchases,
        Prescription: prescriptions.map((row) => row.id),
        Order: orders.map((row) => row.id),
        OrderStatusHistory: history.map((row) => row.id),
        CustomerNoteVersion: notes.map((row) => row.id),
      };
      await checkReferences(tx, plan);
      if (history.length)
        await tx.orderStatusHistory.deleteMany({ where: { id: { in: plan.OrderStatusHistory } } });
      if (orders.length) await tx.order.deleteMany({ where: { id: { in: plan.Order } } });
      if (purchases.length)
        await tx.customerRecord.deleteMany({
          where: { id: { in: purchases }, customerId, deletedAt: { not: null } },
        });
      if (prescriptions.length)
        await tx.prescription.deleteMany({
          where: { id: { in: plan.Prescription }, customerId, deletedAt: { not: null } },
        });
      if (notes.length)
        await tx.$executeRaw`DELETE FROM "CustomerNoteVersion" WHERE "customerId" = ${customerId}`;
      if (!purchaseId) await tx.customer.delete({ where: { id: customerId } });
      return { customerId, purchaseId: purchaseId ?? null, prescriptionIds: plan.Prescription };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 },
  );
}
