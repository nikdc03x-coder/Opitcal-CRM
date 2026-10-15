
import { prisma } from "../config/database";

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customerWriteValidator";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";

import {
  resolveCatalogSelection,
} from "./catalogSelection";

// nik - All customer operations belong to the
// demo shop until authentication is implemented.
const DEMO_SHOP_CODE = "DEMO_SHOP";

// --------------------------------------------------
// 1. FIND SHOP
// --------------------------------------------------

async function getDemoShopId(): Promise<string> {
  const shop = await prisma.shop.findUnique({
    where: {
      code: DEMO_SHOP_CODE,
    },
    select: {
      id: true,
    },
  });

  if (!shop) {
    throw new Error(
      "Demo shop not found. Run the database seed first."
    );
  }

  return shop.id;
}

// --------------------------------------------------
// 2. SEARCH CUSTOMERS
// --------------------------------------------------

export async function searchCustomers(
  phone?: string,
  name?: string
) {
  const shopId = await getDemoShopId();

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

// --------------------------------------------------
// 3. GET CUSTOMER DETAILS
// --------------------------------------------------

export async function getCustomerById(id: string) {
  const shopId = await getDemoShopId();

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

// --------------------------------------------------
// 4. CREATE CUSTOMER
// --------------------------------------------------

export async function createCustomer(
  data: CreateCustomerInput
) {
  const shopId = await getDemoShopId();

  const pricing = calculatePricing(data.record);

  const purchaseDate = data.purchaseDate
    ? new Date(`${data.purchaseDate}T00:00:00.000Z`)
    : null;

  // Customer, prescription, and purchase are saved
  // together or not at all.
  return prisma.$transaction(async (tx) => {
    // Validate catalog selections before creating
    // any customer information.
    const catalog = await resolveCatalogSelection(
      tx,
      shopId,
      data.record
    );

    const customer = await tx.customer.create({
      data: {
        shopId,
        name: data.name,
        mobNumber: data.mobNumber,
        gender: data.gender,
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

// --------------------------------------------------
// 5. UPDATE CUSTOMER
// --------------------------------------------------

// Historical purchase editing also has a separate
// endpoint. Keep this existing method compatible.
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
) {
  const shopId = await getDemoShopId();

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
            : undefined
        )
      : null;

    await tx.customer.update({
      where: {
        id,
      },

      data: {
        name: data.name,
        mobNumber: data.mobNumber,
        gender: data.gender,
        reference: data.reference,
        notes: data.notes,
      },
    });

    // Preserve prescription update behavior.
    if (data.prescription) {
      const measurements = mapPrescription(
        data.prescription
      );

      const latestPrescription =
        existing.prescriptions[0];

      if (latestPrescription) {
        await tx.prescription.update({
          where: {
            id: latestPrescription.id,
          },

          data: measurements,
        });
      } else {
        const newPrescription =
          await tx.prescription.create({
            data: {
              customerId: id,
              ...measurements,
            },
          });

        if (
          latestRecord &&
          !latestRecord.prescriptionId
        ) {
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

      const rates =
        data.record.pricingMode === "SPLIT"
          ? {
              frameRate: data.record.frameRate,
              lensRate: data.record.lensRate,
            }
          : {
              frameRate: null,
              lensRate: null,
            };

      if (latestRecord) {
        await tx.customerRecord.update({
          where: {
            id: latestRecord.id,
          },

          data: {
            ...catalog,
            ...pricing,
            ...rates,
          },
        });
      } else {
        const latestPrescription =
          await tx.prescription.findFirst({
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
            prescriptionId:
              latestPrescription?.id ?? null,

            ...catalog,
            ...pricing,
            ...rates,

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
