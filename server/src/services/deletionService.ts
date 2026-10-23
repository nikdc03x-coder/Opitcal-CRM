import { randomUUID } from "node:crypto";
import { prisma } from "../config/database";
import { getShopId } from "./shopService";
import { HttpError } from "../utils/errors";

// Serializable transactions prevent reference checks racing with purchase creation.
// A group marks only records changed by this operation, preserving older Trash items.
export async function deleteCustomerData(customerId: string, purchaseId?: string) {
  const shopId = await getShopId();
  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, shopId, isActive: true, deletedAt: null },
      });
      if (!customer) throw new HttpError("Customer not found.", 404);
      const deletionGroupId = randomUUID();
      if (!purchaseId) {
        await tx.customerRecord.updateMany({
          where: { customerId, deletionGroupId: null, deletedAt: null },
          data: { deletionGroupId, deletedAt: new Date() },
        });
        await tx.prescription.updateMany({
          where: { customerId, deletionGroupId: null, deletedAt: null },
          data: { deletionGroupId, deletedAt: new Date() },
        });
        await tx.customer.update({
          where: { id: customerId },
          data: { isActive: false, deletedAt: new Date(), deletionGroupId },
        });
        return { customerId, deletionGroupId };
      }
      const purchase = await tx.customerRecord.findFirst({
        where: { id: purchaseId, customerId, deletionGroupId: null, deletedAt: null },
      });
      if (!purchase) throw new HttpError("Purchase not found.", 404);
      await tx.customerRecord.update({
        where: { id: purchaseId },
        data: { deletionGroupId, deletedAt: new Date() },
      });
      let prescriptionId: string | null = null;
      if (purchase.prescriptionId) {
        const exclusive = await tx.prescription.findFirst({
          where: {
            id: purchase.prescriptionId,
            customerId,
            deletionGroupId: null,
            deletedAt: null,
            createdForPurchaseId: purchaseId,
            records: { none: { id: { not: purchaseId }, deletionGroupId: null, deletedAt: null } },
          },
        });
        if (exclusive) {
          await tx.prescription.update({
            where: { id: exclusive.id },
            data: { deletionGroupId, deletedAt: new Date() },
          });
          prescriptionId = exclusive.id;
        }
      }
      return { customerId, purchaseId, prescriptionId, deletionGroupId };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 },
  );
}

export async function listTrash() {
  const shopId = await getShopId();
  const [customers, purchases] = await Promise.all([
    prisma.customer.findMany({
      where: { shopId, deletedAt: { not: null } },
      select: {
        id: true,
        name: true,
        mobNumber: true,
        updatedAt: true,
        deletionGroupId: true,
        _count: { select: { records: true, prescriptions: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.customerRecord.findMany({
      where: { deletedAt: { not: null }, customer: { shopId, isActive: true, deletedAt: null } },
      include: { customer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return { customers, purchases };
}

export async function restoreCustomerData(customerId: string, purchaseId?: string) {
  const shopId = await getShopId();
  return prisma.$transaction(
    async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, shopId } });
      if (!customer) throw new HttpError("Customer not found.", 404);
      if (!purchaseId) {
        if (!customer.deletedAt) throw new HttpError("Customer is not in Trash.", 409);
        if (!customer.deletionGroupId)
          throw new HttpError(
            "This older Trash item has no restoration group. Restore it using the original Trash workflow.",
            409,
          );
        const deletionGroupId = customer.deletionGroupId;
        await tx.customerRecord.updateMany({
          where: { customerId, deletionGroupId },
          data: { deletionGroupId: null, deletedAt: null },
        });
        await tx.prescription.updateMany({
          where: { customerId, deletionGroupId },
          data: { deletionGroupId: null, deletedAt: null },
        });
        await tx.customer.update({
          where: { id: customerId },
          data: { isActive: true, deletionGroupId: null, deletedAt: null },
        });
        return { customerId };
      }
      if (!customer.isActive || customer.deletedAt)
        throw new HttpError("Restore the customer before restoring a purchase.", 409);
      const purchase = await tx.customerRecord.findFirst({
        where: { id: purchaseId, customerId, deletedAt: { not: null } },
      });
      if (!purchase) throw new HttpError("Purchase not found in Trash.", 404);
      if (!purchase.deletionGroupId)
        throw new HttpError(
          "This older Trash item has no restoration group. Restore it using the original Trash workflow.",
          409,
        );
      // Restore its own exclusive prescription; a previously shared prescription might
      // now be in another purchase's deletion group. Restore the dependency only.
      if (purchase.prescriptionId) {
        await tx.prescription.updateMany({
          where: { id: purchase.prescriptionId, customerId, deletionGroupId: { not: null } },
          data: { deletionGroupId: null, deletedAt: null },
        });
      }
      await tx.customerRecord.update({
        where: { id: purchase.id },
        data: { deletionGroupId: null, deletedAt: null },
      });
      return { customerId, purchaseId };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 },
  );
}
