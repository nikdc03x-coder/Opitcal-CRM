
import { prisma } from "../config/database";

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customerWriteValidator";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";

// nik - All customer operations are scoped to the demo shop.
// Later, authentication will determine the authorized shop.
const DEMO_SHOP_CODE = "DEMO_SHOP";

// -----------------------------------------------------
// 1. FIND THE CURRENT SHOP
// -----------------------------------------------------

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

// -----------------------------------------------------
// 2. SEARCH CUSTOMERS
// -----------------------------------------------------

// Return a list because multiple customers can share
// the same mobile number.
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

    // Keep search results small.
    // Private notes are not needed in the search list.
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

// -----------------------------------------------------
// 3. GET CUSTOMER DETAILS
// -----------------------------------------------------

// Retrieve exactly one active customer in this shop.
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

// -----------------------------------------------------
// 4. CREATE CUSTOMER
// -----------------------------------------------------

// A transaction ensures that the personal information,
// prescription and initial purchase are saved together.
export async function createCustomer(
  data: CreateCustomerInput
) {
  const shopId = await getDemoShopId();

  // Always calculate pricing on the backend.
  const pricing = calculatePricing(data.record);

  // Convert a calendar date into a PostgreSQL DATE value.
  // Do not default to today when no purchase date was given.
  const purchaseDate = data.purchaseDate
    ? new Date(`${data.purchaseDate}T00:00:00.000Z`)
    : null;

  return prisma.$transaction(async (tx) => {
    // Step A: Create the customer.
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

    // Step B: Save the prescription if provided.
    const prescription = data.prescription
      ? await tx.prescription.create({
          data: {
            customerId: customer.id,
            ...mapPrescription(data.prescription),
          },
        })
      : null;

    // Step C: Save the purchase with its actual date.
    await tx.customerRecord.create({
      data: {
        customerId: customer.id,
        prescriptionId: prescription?.id ?? null,

        specsType: data.record.specsType,
        lensType: data.record.lensType,

        ...pricing,

        // This is independent of the database createdAt field.
        purchaseDate,
      },
    });

    // Step D: Return the saved customer and related records.
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

// -----------------------------------------------------
// 5. UPDATE CUSTOMER
// -----------------------------------------------------

// Keep existing Update Customer behavior.
// The historical editing endpoints handle exact
// record IDs for purchase and prescription updates.
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
) {
  const shopId = await getDemoShopId();

  return prisma.$transaction(async (tx) => {
    // Step A: Confirm that this active customer
    // belongs to the demo shop.
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

    // Step B: Update only the personal fields provided.
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

    // Step C: Update the latest prescription if supplied.
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
        // Create a new prescription if none exists.
        const newPrescription =
          await tx.prescription.create({
            data: {
              customerId: id,
              ...measurements,
            },
          });

        // Connect the latest purchase if needed.
        const latestRecord = existing.records[0];

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

    // Step D: Update the latest purchase if supplied.
    if (data.record) {
      const pricing = calculatePricing(data.record);
      const latestRecord = existing.records[0];

      // Explicitly handle split prices.
      // MRP-only records do not keep separate rates.
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
            specsType: data.record.specsType,
            lensType: data.record.lensType,

            ...pricing,
            ...rates,
          },
        });
      } else {
        // Create a purchase when none exists.
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

            specsType: data.record.specsType,
            lensType: data.record.lensType,

            ...pricing,
            ...rates,

            purchaseDate: null,
          },
        });
      }
    }

    // Step E: Return the updated customer.
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
