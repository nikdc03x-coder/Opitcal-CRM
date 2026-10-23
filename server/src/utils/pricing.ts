import type { RecordInput } from "../validators/customerWriteValidator";

// Convert a rupee amount into a whole number of paise.
function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

// The backend always determines the final amount.
// The frontend cannot override a split-price calculation.
export function calculatePricing(record: RecordInput) {
  if (record.pricingMode === "SPLIT") {
    // Determine presence of frame/lens based on either catalog references or explicit rate values.
    const hasFrameRate = record.frameRate !== null && record.frameRate !== undefined;
    const hasLensRate = record.lensRate !== null && record.lensRate !== undefined;
    const frame = Boolean(record.specsType?.trim() || record.frameCatalogId || hasFrameRate);
    const lens = Boolean(record.lensType?.trim() || record.lensCatalogId || hasLensRate);
    const frameRate = frame ? record.frameRate : null;
    const lensRate = lens ? record.lensRate : null;
    const unknown =
      (!frame && !lens) || (frame && frameRate === null) || (lens && lensRate === null);

    return {
      pricingMode: "SPLIT" as const,
      frameRate,
      lensRate,
      mrp: unknown ? null : (toPaise(frameRate ?? 0) + toPaise(lensRate ?? 0)) / 100,
    };
  }

  return {
    pricingMode: "MRP_ONLY" as const,
    frameRate: null,
    lensRate: null,
    mrp: record.mrp,
  };
}
