
import { prisma } from "../config/database";

import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../validators/customerWriteValidator";

import { calculatePricing } from "../utils/pricing";
import { mapPrescription } from "../utils/prescription";

// -----------------------------------------------------
// 1. DEFAULT SHOP
// -----------------------------------------------------

// We will use this shop while developing with dummy data.
// Later, the selected shop will come from the logged-in
// administrator's authorized shop selection.
const DEMO_SHOP_CODE = "DEMO_SHOP";

// Find the demo shop in PostgreSQL.
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

// Search by mobile number or name.
// One mobile number can belong to multiple customers,
// so we always return a list instead of one record.
export async function searchCustomers(
  phone?: string,
  name?: string
) {
  const shopId = await getDemoShopId();

  const customers = await prisma.customer.findMany({
    where: {
      shopId,
      isActive: true,

      // Partial phone search is supported.
      ...(phone
        ? {
            mobNumber: {
              contains: phone,
            },
          }
        : {}),

      // Name search is case-insensitive.
      ...(name
        ? {
            name: {
              contains: name,
              mode: "insensitive" as const,
            },
          }
        : {}),
    },

    // Return only information needed in search results.
    // Internal notes should not appear in search listings.
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

    // Limit initial results for better performance.
    // Proper pagination will be added later.
    take: 50,
  });

  return customers;
}

// -----------------------------------------------------
// 3. GET CUSTOMER DETAILS
// -----------------------------------------------------

// Find a customer by their unique ID.
// Include all related prescriptions and purchase records.
export async function getCustomerById(id: string) {
  const shopId = await getDemoShopId();

  const customer = await prisma.customer.findFirst({
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

  return customer;
}

// -----------------------------------------------------
// 4. CREATE CUSTOMER
// -----------------------------------------------------

// Register a customer with an optional prescription
// and one initial purchase record.
//
// We use a database transaction so either every
// related record is saved or nothing is saved.
export async function createCustomer(
  data: CreateCustomerInput
) {
  const shopId = await getDemoShopId();

  // Calculate the total price on the backend.
  // This prevents incorrect totals from the frontend.
  const pricing = calculatePricing(data.record);

  return prisma.$transaction(async (tx) => {
    // Step A: Save the customer's personal information.
    const customer = await tx.customer.create({
      data: {
        shopId,
        name: data.name,
        mobNumber: data.mobNumber,
        gender: data.gender,
        reference: data.reference,

        // Notes are for internal staff use only.
        notes: data.notes,
      },
    });

    // Step B: Save the prescription if supplied.
    // Some customers may not need prescription details.
    const prescription = data.prescription
      ? await tx.prescription.create({
          data: {
            customerId: customer.id,
            ...mapPrescription(data.prescription),
          },
        })
      : null;

    // Step C: Save the frame, lens and pricing details.
    // Link the purchase to the prescription if it exists.
    await tx.customerRecord.create({
      data: {
        customerId: customer.id,
        prescriptionId: prescription?.id ?? null,

        specsType: data.record.specsType,
        lensType: data.record.lensType,

        ...pricing,
      },
    });

    // Step D: Return the complete saved customer.
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

// Update personal details and optionally edit the
// latest prescription or purchase record.
//
// All changes occur inside one database transaction.
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput
) {
  const shopId = await getDemoShopId();

  return prisma.$transaction(async (tx) => {
    // Step A: Check whether the customer exists
    // and belongs to the selected demo shop.
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

    // Return null if the customer does not exist.
    if (!existing) {
      return null;
    }

    // Step B: Update only the provided personal fields.
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

      const latestPrescription = existing.prescriptions[0];

      if (latestPrescription) {
        // Edit the existing latest prescription.
        await tx.prescription.update({
          where: {
            id: latestPrescription.id,
          },

          data: measurements,
        });
      } else {
        // Create a prescription if none exists.
        const newPrescription =
          await tx.prescription.create({
            data: {
              customerId: id,
              ...measurements,
            },
          });

        // If the existing purchase has no prescription,
        // connect it to the newly created prescription.
        const latestRecord = existing.records[0];

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

    // Step D: Update frame, lens and price information.
    if (data.record) {
      const pricing = calculatePricing(data.record);

      const latestRecord = existing.records[0];

      if (latestRecord) {
        // Update the latest purchase-related record.
        await tx.customerRecord.update({
          where: {
            id: latestRecord.id,
          },

          data: {
            specsType: data.record.specsType,
            lensType: data.record.lensType,

            ...pricing,
          },
        });
      } else {
        // Create a purchase record if none exists.
        // Link it to the latest available prescription.
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
          },
        });
      }
    }

    // Step E: Return the updated customer,
    // including their prescriptions and records.
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
