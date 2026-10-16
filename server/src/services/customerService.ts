import { prisma } from "../config/database";
import { getShopId } from "./shopService";

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customerWriteValidator";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";

import { resolveCatalogSelection } from "./catalogSelection";

export async function searchCustomers(phone?: string, name?: string) {
  const shopId = await getShopId();

  return prisma.customer.findMany({
    where: {
      shopId,
      isActive: true,

      ...(phone
        ? {
            mobNumber: {
              contains: phone,
            },
          }
        : {}),

      ...(name
        ? {
            name: {
              contains: name,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },

    select: {
      id: true,
      name: true,
      mobNumber: true,
      gender: true,
      createdAt: true,
    },

    orderBy: {
      createdAt: "desc",
    },

    take: 50,
  });
}

export async function getCustomerById(id: string) {
  const shopId = await getShopId();

  return prisma.customer.findFirst({
    where: {
      id,
      shopId,
      isActive: true,
    },

    include: {
      prescriptions: {
        orderBy: {
          createdAt: "desc",
        },
      },

      records: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function createCustomer(data: CreateCustomerInput) {
  const shopId = await getShopId();

  const pricing = calculatePricing(data.record);

  const purchaseDate = data.purchaseDate ? new Date(`${data.purchaseDate}T00:00:00.000Z`) : null;

  // Customer, prescription, and purchase are saved
  // together or not at all.
  return prisma.$transaction(async (tx) => {
    // Validate catalog selections before creating
    // any customer information.
    const catalog = await resolveCatalogSelection(tx, shopId, data.record);

    const customer = await tx.customer.create({
      data: {
        shopId,
        name: data.name,
        mobNumber: data.mobNumber,
        gender: data.gender,
        // nik - Only the server sets the date of a newly recorded age.
        ageAtRecording: data.ageAtRecording ?? null,
        ageRecordedAt: data.ageAtRecording == null ? null : new Date(),
        reference: data.reference,
        notes: data.notes,
      },
    });

    const prescription = data.prescription
      ? await tx.prescription.create({
          data: {
            customerId: customer.id,
            ...mapPrescription(data.prescription),
          },
        })
      : null;

    await tx.customerRecord.create({
      data: {
        customerId: customer.id,
        prescriptionId: prescription?.id ?? null,

        // Validated catalog IDs and historical names.
        ...catalog,

        ...pricing,

        purchaseDate,
      },
    });

    return tx.customer.findUniqueOrThrow({
      where: {
        id: customer.id,
      },

      include: {
        prescriptions: true,
        records: true,
      },
    });
  });
}

// Historical purchase editing also has a separate
// endpoint. Keep this existing method compatible.
export async function updateCustomer(id: string, data: UpdateCustomerInput) {
  const shopId = await getShopId();

  return prisma.$transaction(async (tx) => {
    const existing = await tx.customer.findFirst({
      where: {
        id,
        shopId,
        isActive: true,
      },

      include: {
        prescriptions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },

        records: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!existing) {
      return null;
    }

    // Resolve catalog selections before changing data.
    const latestRecord = existing.records[0];

    const catalog = data.record
      ? await resolveCatalogSelection(
          tx,
          shopId,
          data.record,
          latestRecord
            ? {
                frameCatalogId: latestRecord.frameCatalogId,
                lensCatalogId: latestRecord.lensCatalogId,
                specsType: latestRecord.specsType,
                lensType: latestRecord.lensType,
              }
            : undefined,
        )
      : null;

    // nik - Preserve the observation date unless age changes; clearing age clears its date too.
    const ageUpdate =
      data.ageAtRecording === undefined || data.ageAtRecording === existing.ageAtRecording
        ? {}
        : {
            ageAtRecording: data.ageAtRecording,
            ageRecordedAt: data.ageAtRecording === null ? null : new Date(),
          };

    await tx.customer.update({
      where: {
        id,
      },

      data: {
        name: data.name,
        mobNumber: data.mobNumber,
        gender: data.gender,
        ...ageUpdate,
        reference: data.reference,
        notes: data.notes,
      },
    });

    // Preserve prescription update behavior.
    if (data.prescription) {
      const measurements = mapPrescription(data.prescription);

      const latestPrescription = existing.prescriptions[0];

      if (latestPrescription) {
        await tx.prescription.update({
          where: {
            id: latestPrescription.id,
          },

          data: measurements,
        });
      } else {
        const newPrescription = await tx.prescription.create({
          data: {
            customerId: id,
            ...measurements,
          },
        });

        if (latestRecord && !latestRecord.prescriptionId) {
          await tx.customerRecord.update({
            where: {
              id: latestRecord.id,
            },

            data: {
              prescriptionId: newPrescription.id,
            },
          });
        }
      }
    }

    // Update only the latest purchase when requested.
    if (data.record && catalog) {
      const pricing = calculatePricing(data.record);

      if (latestRecord) {
        await tx.customerRecord.update({
          where: {
            id: latestRecord.id,
          },

          data: {
            ...catalog,
            ...pricing,
          },
        });
      } else {
        const latestPrescription = await tx.prescription.findFirst({
          where: {
            customerId: id,
          },

          orderBy: {
            createdAt: "desc",
          },
        });

        await tx.customerRecord.create({
          data: {
            customerId: id,
            prescriptionId: latestPrescription?.id ?? null,

            ...catalog,
            ...pricing,

            purchaseDate: null,
          },
        });
      }
    }

    return tx.customer.findUniqueOrThrow({
      where: {
        id,
      },

      include: {
        prescriptions: {
          orderBy: {
            createdAt: "desc",
          },
        },

        records: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });
  });
}
