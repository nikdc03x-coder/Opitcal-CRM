import type { Prescription } from "../models/customer";
import type { NewPurchasePayload } from "../services/customerApi";

import { todayInIndia } from "./dates";

import {
  emptyPrescriptionDraft,
  eyes,
  opticalValueError,
  readPrescriptionDraft,
  validDate,
  validMoney,
  type EyeFieldName,
  type PrescriptionDraft,
} from "./opticalForm";

export type NewPurchaseForm = {
  purchaseDate: string;
  specsType: string;
  lensType: string;
  frameCatalogId: string;
  lensCatalogId: string;
  pricingMode: "SPLIT" | "MRP_ONLY";
  frameRate: string;
  lensRate: string;
  mrp: string;
  prescriptionMode: "NONE" | "EXISTING" | "NEW";
  prescriptionId: string;
  prescription: PrescriptionDraft;
};

export type PurchaseFormErrors = Partial<
  Record<Exclude<keyof NewPurchaseForm, "prescription"> | EyeFieldName | "total", string>
>;

// Start with blank optional fields and today's purchase date.
export function initialNewPurchaseForm(): NewPurchaseForm {
  return {
    purchaseDate: todayInIndia(),
    specsType: "",
    lensType: "",
    frameCatalogId: "",
    lensCatalogId: "",
    pricingMode: "SPLIT",
    frameRate: "",
    lensRate: "",
    mrp: "",
    prescriptionMode: "NONE",
    prescriptionId: "",
    prescription: emptyPrescriptionDraft(),
  };
}

// Return null for an unknown price, preserving an explicit zero.
function optionalMoney(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  if (!validMoney(trimmed)) return null;

  return Math.round(Number(trimmed) * 100) / 100;
}

// Calculate the total only when all applicable rates are known.
export function purchaseTotal(
  values: Pick<
    NewPurchaseForm,
    | "pricingMode"
    | "specsType"
    | "lensType"
    | "frameCatalogId"
    | "lensCatalogId"
    | "frameRate"
    | "lensRate"
    | "mrp"
  >,
): number | null {
  if (values.pricingMode === "MRP_ONLY") {
    return optionalMoney(values.mrp);
  }

  const hasFrame = Boolean(values.specsType.trim() || values.frameCatalogId);

  const hasLens = Boolean(values.lensType.trim() || values.lensCatalogId);

  if (!hasFrame && !hasLens) {
    return null;
  }

  const frameRate = hasFrame ? optionalMoney(values.frameRate) : 0;

  const lensRate = hasLens ? optionalMoney(values.lensRate) : 0;

  if (frameRate === null || lensRate === null) {
    return null;
  }

  return Math.round((frameRate + lensRate) * 100) / 100;
}

// Validate the form and build the existing API payload.
export function prepareNewPurchase(
  values: NewPurchaseForm,
  prescriptions: Pick<Prescription, "id">[],
): {
  errors: PurchaseFormErrors;
  payload?: NewPurchasePayload;
} {
  const errors: PurchaseFormErrors = {};

  const specsType = values.specsType.trim() || null;
  const lensType = values.lensType.trim() || null;

  const hasFrame = Boolean(specsType || values.frameCatalogId);

  const hasLens = Boolean(lensType || values.lensCatalogId);

  // Purchase date remains required.
  if (!validDate(values.purchaseDate)) {
    errors.purchaseDate = "Enter a valid purchase date.";
  }

  // Product names are optional, but must respect length limits.
  if (specsType && specsType.length > 100) {
    errors.specsType = "Frame name cannot exceed 100 characters.";
  }

  if (lensType && lensType.length > 100) {
    errors.lensType = "Lens name cannot exceed 100 characters.";
  }

  // Only validate entered prices, never require blank rates.
  const activePriceFields =
    values.pricingMode === "SPLIT"
      ? [...(hasFrame ? ["frameRate" as const] : []), ...(hasLens ? ["lensRate" as const] : [])]
      : (["mrp"] as const);

  for (const field of activePriceFields) {
    const raw = values[field].trim();

    // Empty price is invalid when the corresponding component is present.
    if (!raw) {
      errors[field] = "Enter a valid non-negative price (maximum 2 decimals).";
      continue;
    }

    if (!validMoney(raw)) {
      errors[field] = "Enter a valid non-negative price (maximum 2 decimals).";
    }
  }

  const total = purchaseTotal(values);

  if (total !== null && total <= 0) {
    errors.total = "Purchase total must be greater than zero.";
  }

  if (total !== null && total > 9999999999.99) {
    errors.total = "Purchase total cannot exceed ₹9,999,999,999.99.";
  }

  // Existing prescriptions must belong to this customer.
  if (
    values.prescriptionMode === "EXISTING" &&
    !prescriptions.some((rx) => rx.id === values.prescriptionId)
  ) {
    errors.prescriptionId = "Select a prescription belonging to this customer.";
  }

  // Preserve existing optical measurement validation.
  if (values.prescriptionMode === "NEW") {
    for (const eye of eyes) {
      for (const measure of ["sph", "cyl", "axis"] as const) {
        const field: EyeFieldName = `${eye.prefix}_${measure}`;

        const message = opticalValueError(values.prescription[field], measure);

        if (message) {
          errors[field] = message;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Clear catalog links for products that were not selected.
  const products = {
    specsType,
    lensType,
    frameCatalogId: hasFrame ? values.frameCatalogId || null : null,
    lensCatalogId: hasLens ? values.lensCatalogId || null : null,
  };

  const prescription =
    values.prescriptionMode === "NEW" ? readPrescriptionDraft(values.prescription) : undefined;

  // Null represents an unknown rate; zero represents an actual ₹0.
  const frameRate = hasFrame ? optionalMoney(values.frameRate) : null;

  const lensRate = hasLens ? optionalMoney(values.lensRate) : null;

  const mrp = optionalMoney(values.mrp);

  return {
    errors,
    payload: {
      purchaseDate: values.purchaseDate,
      prescriptionId: values.prescriptionMode === "EXISTING" ? values.prescriptionId : null,
      ...(prescription ? { prescription } : {}),
      record:
        values.pricingMode === "SPLIT"
          ? {
              ...products,
              pricingMode: "SPLIT",
              frameRate,
              lensRate,
            }
          : {
              ...products,
              pricingMode: "MRP_ONLY",
              mrp,
            },
    },
  };
}
