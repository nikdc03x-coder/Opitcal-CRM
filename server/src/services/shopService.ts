import { prisma } from "../config/database";

// Preserve the existing single-shop identifier across all CRM services.
export const SHOP_CODE = "DEMO_SHOP";

export async function getShopId(): Promise<string> {
  const shop = await prisma.shop.findUnique({
    where: { code: SHOP_CODE },
    select: { id: true },
  });

  if (!shop) {
    throw new Error("CRM shop not found. Run the database seed first.");
  }

  return shop.id;
}
