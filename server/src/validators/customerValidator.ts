
import { prisma } from "../config/database";

// Our single demo shop is used until the final
// authentication and shop-selection phase.
const DEMO_SHOP_CODE = "DEMO_SHOP";

// Find the shop ID without hardcoding a database UUID.
async function getDemoShopId() {
  const shop = await prisma.shop.findUnique({
    where: { code: DEMO_SHOP_CODE },
    select: { id: true },
  });

  if (!shop) {
    throw new Error(
      "Demo shop not found. Run the database seed first."
    );
  }

  return shop.id;
}

// Find all customers matching a name or phone number.
// Never use findFirst for a phone search because
// several family members can share one number.
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
        ? { mobNumber: { contains: phone } }
        : {}),
      ...(name
        ? { name: { contains: name, mode: "insensitive" } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      mobNumber: true,
      gender: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// Load one customer using their unique ID.
// Include their prescription and purchase history.
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
        orderBy: { createdAt: "desc" },
      },
      records: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}
