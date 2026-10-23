import { z } from "zod";

import { prescriptionSchema, recordSchema, purchaseDateSchema } from "./customerWriteValidator";
import { calculatePricing } from "../utils/pricing";

// Purchase dates may be unknown for imported records.
export const purchaseUpdateSchema = z
  .object({
    record: recordSchema,
    purchaseDate: purchaseDateSchema.nonoptional(),
  })
  .strict();

export const createPurchaseRecordSchema = z
  .object({
    record: recordSchema,
    purchaseDate: purchaseDateSchema,
    prescriptionId: z.string().uuid().nullable().optional(),
    prescription: prescriptionSchema.optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    const issue = (message: string, path: string[]) =>
      ctx.addIssue({ code: "custom", message, path });
    if (input.prescriptionId && input.prescription) {
      issue("Link an existing prescription or enter a new one, not both.", ["prescriptionId"]);
    }
    if (
      input.prescription &&
      !Object.values(input.prescription).some(
        (eye) => eye && Object.values(eye).some((value) => value != null),
      )
    ) {
      issue("Enter at least one prescription measurement.", ["prescription"]);
    }
    const total = calculatePricing(input.record).mrp;
    if (total !== null && total > 9999999999.99) {
      issue("Purchase total must be at most 9999999999.99.", ["record"]);
    }
    // Ensure MRP_ONLY has a positive total and at least one descriptor (specsType or lensType).
    if (input.record.pricingMode === "MRP_ONLY") {
      if (total === null || total <= 0) {
        issue("MRP total must be greater than 0.", ["record", "mrp"]);
      }
      const hasSpecs = Boolean(input.record.specsType?.trim() || input.record.frameCatalogId);
      const hasLens = Boolean(input.record.lensType?.trim() || input.record.lensCatalogId);
      if (!hasSpecs && !hasLens) {
        issue("Provide at least a specsType or lensType for MRP_ONLY pricing.", ["record"]);
      }
    }
    // SPLIT mode validation: require at least one component and matching fields.
    if (input.record.pricingMode === "SPLIT") {
      const hasFrame = Boolean(
        (input.record as any).specsType?.trim() || (input.record as any).frameCatalogId,
      );
      const hasLens = Boolean(
        (input.record as any).lensType?.trim() || (input.record as any).lensCatalogId,
      );
      if (!hasFrame && !hasLens) {
        issue("Provide at least a frame or lens for SPLIT pricing.", ["record"]);
      }
      if (
        !hasFrame &&
        (input.record as any).frameRate != null &&
        (input.record as any).frameRate !== 0
      ) {
        issue("Frame rate provided without a frame selection.", ["record", "frameRate"]);
      }
      if (
        !hasLens &&
        (input.record as any).lensRate != null &&
        (input.record as any).lensRate !== 0
      ) {
        issue("Lens rate provided without a lens selection.", ["record", "lensRate"]);
      }
      if (hasFrame && (input.record as any).frameRate == null) {
        issue("Frame rate required when a frame is selected.", ["record", "frameRate"]);
      }
      if (hasLens && (input.record as any).lensRate == null) {
        issue("Lens rate required when a lens is selected.", ["record", "lensRate"]);
      }
    }
  });

// All four eye groups use the existing prescription validation.
export const prescriptionUpdateSchema = prescriptionSchema;

export type PurchaseUpdateInput = z.infer<typeof purchaseUpdateSchema>;

export type CreatePurchaseRecordInput = z.infer<typeof createPurchaseRecordSchema>;

export type PrescriptionUpdateInput = z.infer<typeof prescriptionUpdateSchema>;
