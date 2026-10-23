import { prisma } from "../config/database";

// Preserve the existing single-shop identifier across all CRM services.
export const SHOP_CODE = "DEMO_SHOP";

// Only the single-shop identifier is cached, never sessions or customer data.
const SHOP_ID_TTL_MS = 60_000;
let cached: { id: string; expiresAt: number } | null = null;
let pending: Promise<string> | null = null;

export function clearShopIdCache() {
  cached = null;
  pending = null;
}

export function getShopId(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.id);
  if (pending) return pending;
  const request = prisma.shop
    .findUnique({
      where: { code: SHOP_CODE },
      select: { id: true },
    })
    .then((shop) => {
      if (!shop) throw new Error("CRM shop not found. Run the database seed first.");
      if (pending === request) cached = { id: shop.id, expiresAt: Date.now() + SHOP_ID_TTL_MS };
      return shop.id;
    })
    .finally(() => {
      if (pending === request) pending = null;
    });
  pending = request;
  return request;
}
