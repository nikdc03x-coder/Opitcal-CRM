import { prisma } from "../config/database";
import { getShopId } from "./shopService";

import type {
  CatalogListInput,
  FrameCreateInput,
  FrameUpdateInput,
  LensCreateInput,
  LensUpdateInput,
} from "../validators/catalogValidator";

// Match one catalog ID within the current shop. Purchase snapshots are retained;
// the existing optional catalog relations use ON DELETE SET NULL.
export async function deleteFrame(id: string) {
  const shopId = await getShopId();
  const result = await prisma.frameCatalog.deleteMany({ where: { id, shopId } });
  return result.count === 1;
}

export async function deleteLens(id: string) {
  const shopId = await getShopId();
  const result = await prisma.lensCatalog.deleteMany({ where: { id, shopId } });
  return result.count === 1;
}

// FRAME CATALOG

export async function listFrames(filters: CatalogListInput) {
  const shopId = await getShopId();
  const search = filters.search;

  return prisma.frameCatalog.findMany({
    where: {
      shopId,
      ...(filters.includeInactive === "true" ? {} : { isActive: true }),

      ...(search
        ? {
            OR: [
              { brand: { contains: search, mode: "insensitive" } },
              { model: { contains: search, mode: "insensitive" } },
              { frameCode: { contains: search, mode: "insensitive" } },
              { frameStyle: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    take: 100,
  });
}

export async function createFrame(input: FrameCreateInput) {
  const shopId = await getShopId();

  return prisma.frameCatalog.create({
    data: {
      shopId,
      brand: input.brand,
      model: input.model,
      frameCode: input.frameCode,
      frameStyle: input.frameStyle,
      description: input.description,
    },
  });
}

export async function updateFrame(id: string, input: FrameUpdateInput) {
  const shopId = await getShopId();

  // Update only a frame that belongs to this shop.
  const result = await prisma.frameCatalog.updateManyAndReturn({
    where: { id, shopId },
    data: input,
  });

  return result[0] ?? null;
}

// LENS CATALOG

export async function listLenses(filters: CatalogListInput) {
  const shopId = await getShopId();
  const search = filters.search;

  return prisma.lensCatalog.findMany({
    where: {
      shopId,
      ...(filters.includeInactive === "true" ? {} : { isActive: true }),

      ...(search
        ? {
            OR: [
              { company: { contains: search, mode: "insensitive" } },
              { lensName: { contains: search, mode: "insensitive" } },
              { visionType: { contains: search, mode: "insensitive" } },
              { coating: { contains: search, mode: "insensitive" } },
              { lensCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ company: "asc" }, { lensName: "asc" }],
    take: 100,
  });
}

export async function createLens(input: LensCreateInput) {
  const shopId = await getShopId();

  return prisma.lensCatalog.create({
    data: {
      shopId,
      company: input.company,
      lensName: input.lensName,
      visionType: input.visionType,
      coating: input.coating,
      lensCode: input.lensCode,
      description: input.description,
    },
  });
}

export async function updateLens(id: string, input: LensUpdateInput) {
  const shopId = await getShopId();

  const result = await prisma.lensCatalog.updateManyAndReturn({
    where: { id, shopId },
    data: input,
  });

  return result[0] ?? null;
}
