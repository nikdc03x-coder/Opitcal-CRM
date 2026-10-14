
import type { RecordInput } from "../validators/customerWriteValidator";

// Convert a rupee amount into a whole number of paise.
function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

// The backend always determines the final amount.
// The frontend cannot override a split-price calculation.
export function calculatePricing(record: RecordInput) {
  if (record.pricingMode === "SPLIT") {
    const totalPaise =
      toPaise(record.frameRate) +
      toPaise(record.lensRate);

    return {
      pricingMode: "SPLIT" as const,
      frameRate: record.frameRate,
      lensRate: record.lensRate,
      mrp: totalPaise / 100,
    };
  }

  return {
    pricingMode: "MRP_ONLY" as const,
    frameRate: null,
    lensRate: null,
    mrp: record.mrp,
  };
}
