import { randomUUID } from "node:crypto";
import { prisma } from "../config/database";
import { getShopId } from "./shopService";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";
import { HttpError } from "../utils/errors";

import { resolveCatalogSelection } from "./catalogSelection";

import type {
  PurchaseUpdateInput,
  PrescriptionUpdateInput,
  CreatePurchaseRecordInput,
} from "../validators/historyValidator";

// Edit only the selected historical record.
// Other customers and purchases must remain unchanged.

async function getAllowedCustomer(customerId: string) {
  const shopId = await getShopId();

  return prisma.customer.findFirst({
    where: {
      id: customerId,
      shopId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      shopId: true,
    },
  });
}

export async function updateCustomerPurchase(
  customerId: string,
  recordId: string,
  input: PurchaseUpdateInput,
) {
  const customer = await getAllowedCustomer(customerId);

  if (!customer) {
    return null;
  }

  const pricing = calculatePricing(input.record);

  // Validate the purchase and its catalog selections
  // inside one transaction.
  return prisma.$transaction(async (tx) => {
    const existing = await tx.customerRecord.findFirst({
      where: {
        id: recordId,
        customerId: customer.id,
        deletionGroupId: null,
        deletedAt: null,
      },

      select: {
        id: true,
        frameCatalogId: true,
        lensCatalogId: true,
        specsType: true,
        lensType: true,
      },
    });

    if (!existing) {
      return null;
    }

    const catalog = await resolveCatalogSelection(tx, customer.shopId, input.record, existing);

    // Update exactly the selected historical purchase.
    return tx.customerRecord.update({
      where: {
        id: existing.id,
      },

      data: {
        ...catalog,

        ...pricing,

        purchaseDate: input.purchaseDate ? new Date(`${input.purchaseDate}T00:00:00.000Z`) : null,
      },
    });
  });
}

export async function addCustomerPurchase(customerId: string, input: CreatePurchaseRecordInput) {
  const customer = await getAllowedCustomer(customerId);

  if (!customer) {
    return null;
  }

  const purchaseId = randomUUID();
  const pricing = calculatePricing(input.record);
  const purchaseDate = input.purchaseDate ? new Date(`${input.purchaseDate}T00:00:00.000Z`) : null;

  return prisma.$transaction(
    async (tx) => {
      // Read the parent inside the serializable snapshot so deletion cannot race
      // a purchase insert and leave an active child outside its deletion group.
      const activeCustomer = await tx.customer.findFirst({
        where: { id: customer.id, shopId: customer.shopId, isActive: true, deletedAt: null },
        select: { id: true, shopId: true },
      });
      if (!activeCustomer) throw new HttpError("Customer not found.", 404);
      if (input.prescriptionId) {
        const rx = await tx.prescription.findFirst({
          where: {
            id: input.prescriptionId,
            customerId: customer.id,
            deletionGroupId: null,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!rx) {
          throw new HttpError("Prescription not found for this customer.", 400);
        }
      }

      const catalog = await resolveCatalogSelection(tx, customer.shopId, input.record);

      const prescription = input.prescription
        ? await tx.prescription.create({
            data: {
              customerId: customer.id,
              createdForPurchaseId: purchaseId,
              ...mapPrescription(input.prescription),
            },
          })
        : null;

      return tx.customerRecord.create({
        data: {
          customerId: customer.id,
          deletionGroupId: null,
          deletedAt: null,
          id: purchaseId,
          prescriptionId: prescription?.id ?? input.prescriptionId ?? null,
          ...catalog,
          ...pricing,
          purchaseDate,
        },
        include: { prescription: true },
      });
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 },
  );
}

export async function updateCustomerPrescription(
  customerId: string,
  prescriptionId: string,
  input: PrescriptionUpdateInput,
) {
  const customer = await getAllowedCustomer(customerId);

  if (!customer) {
    return null;
  }

  const existing = await prisma.prescription.findFirst({
    where: {
      id: prescriptionId,
      customerId: customer.id,
      deletionGroupId: null,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    return null;
  }

  const measurements = mapPrescription(input);

  return prisma.prescription.update({
    where: {
      id: existing.id,
    },
    data: measurements,
  });
}
