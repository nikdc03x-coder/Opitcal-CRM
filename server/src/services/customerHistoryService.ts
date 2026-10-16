import { prisma } from "../config/database";
import { getShopId } from "./shopService";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";

import { resolveCatalogSelection } from "./catalogSelection";

import type { PurchaseUpdateInput, PrescriptionUpdateInput } from "../validators/historyValidator";

// Edit only the selected historical record.
// Other customers and purchases must remain unchanged.

async function getAllowedCustomer(customerId: string) {
  const shopId = await getShopId();

  return prisma.customer.findFirst({
    where: {
      id: customerId,
      shopId,
      isActive: true,
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
