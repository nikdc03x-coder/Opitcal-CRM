import type { CustomerRecord, Prescription } from "../models/customer";
export type PurchaseFlag = "FRAME_ONLY" | "LENS_ONLY" | "FRAME_AND_LENS" | "NOT_SPECIFIED";

export function getPurchaseFlag(
  record: Pick<CustomerRecord, "specsType" | "lensType">,
): PurchaseFlag {
  const frame = Boolean(record.specsType?.trim());
  const lens = Boolean(record.lensType?.trim());
  return frame && lens
    ? "FRAME_AND_LENS"
    : frame
      ? "FRAME_ONLY"
      : lens
        ? "LENS_ONLY"
        : "NOT_SPECIFIED";
}

// Unknown purchase dates come last. Creation time and ID break ties deterministically.
export function sortPurchases(records: CustomerRecord[]): CustomerRecord[] {
  return [...records].sort(
    (a, b) =>
      (b.purchaseDate ?? "").localeCompare(a.purchaseDate ?? "") ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
}

export function sortPrescriptions(prescriptions: Prescription[]): Prescription[] {
  return [...prescriptions].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}

export function measurementDifference(
  first: string | number | null | undefined,
  second: string | number | null | undefined,
): number | null {
  const missing = (value: typeof first) => value == null || String(value).trim() === "";
  if (missing(first) || missing(second)) return null;
  const a = Number(first);
  const b = Number(second);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) * 100) / 100 : null;
}

export function customerDetailsUrl(id: string, search = "", newPurchase = false): string {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (newPurchase) params.set("purchase", "new");
  return `/customers/${encodeURIComponent(id)}${params.size ? `?${params}` : ""}`;
}
