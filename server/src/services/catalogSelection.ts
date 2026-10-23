import type { Prisma } from "../generated/prisma/client";
import { CatalogSelectionError } from "../utils/errors";
export { CatalogSelectionError } from "../utils/errors";

import type { RecordInput } from "../validators/customerWriteValidator";

// Save a product's name as it appeared
// when the customer made the purchase.

type DatabaseClient = Prisma.TransactionClient;

type ExistingCatalogSelection = {
  frameCatalogId: string | null;
  lensCatalogId: string | null;
  specsType: string | null;
  lensType: string | null;
};

function checkSnapshotLength(name: string, label: string): string {
  if (name.length > 100) {
    throw new CatalogSelectionError(`${label} name is too long for a purchase record.`);
  }

  return name;
}

// Resolve both catalog references within the same
// transaction used to save the purchase.
export async function resolveCatalogSelection(
  tx: DatabaseClient,
  shopId: string,
  record: RecordInput,
  existing?: ExistingCatalogSelection,
) {
  let frameCatalogId =
    record.frameCatalogId !== undefined
      ? record.frameCatalogId
      : (existing?.frameCatalogId ?? null);

  let lensCatalogId =
    record.lensCatalogId !== undefined ? record.lensCatalogId : (existing?.lensCatalogId ?? null);

  let specsType = record.specsType !== undefined ? record.specsType : (existing?.specsType ?? null);

  let lensType = record.lensType !== undefined ? record.lensType : (existing?.lensType ?? null);

  // Newly chosen IDs must refer to active products
  // in the same shop. Previously linked inactive items
  // may remain attached to old purchases.
  if (record.frameCatalogId && record.frameCatalogId === existing?.frameCatalogId) {
    specsType = existing.specsType;
  }

  if (record.lensCatalogId && record.lensCatalogId === existing?.lensCatalogId) {
    lensType = existing.lensType;
  }

  if (record.frameCatalogId && record.frameCatalogId !== existing?.frameCatalogId) {
    const frame = await tx.frameCatalog.findFirst({
      where: {
        id: record.frameCatalogId,
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        brand: true,
        model: true,
      },
    });

    if (!frame) {
      throw new CatalogSelectionError("Selected frame is unavailable or inactive.");
    }

    frameCatalogId = frame.id;
    specsType = checkSnapshotLength(`${frame.brand} - ${frame.model}`, "Frame");
  }

  if (record.lensCatalogId && record.lensCatalogId !== existing?.lensCatalogId) {
    const lens = await tx.lensCatalog.findFirst({
      where: {
        id: record.lensCatalogId,
        shopId,
        isActive: true,
      },
      select: {
        id: true,
        company: true,
        lensName: true,
        visionType: true,
        coating: true,
      },
    });

    if (!lens) {
      throw new CatalogSelectionError("Selected lens is unavailable or inactive.");
    }

    lensCatalogId = lens.id;

    const coating = lens.coating ? ` - ${lens.coating}` : "";

    lensType = checkSnapshotLength(
      `${lens.company} - ${lens.lensName} - ${lens.visionType}${coating}`,
      "Lens",
    );
  }

  // An explicitly cleared catalog reference may use
  // manual text supplied by the frontend instead.
  return {
    frameCatalogId,
    lensCatalogId,
    specsType,
    lensType,
  };
}
