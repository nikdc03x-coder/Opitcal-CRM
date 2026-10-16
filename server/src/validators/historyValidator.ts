import { z } from "zod";

import { prescriptionSchema, recordSchema, purchaseDateSchema } from "./customerWriteValidator";

// Purchase dates may be unknown for imported records.
export const purchaseUpdateSchema = z
  .object({
    record: recordSchema,
    purchaseDate: purchaseDateSchema.nonoptional(),
  })
  .strict();

// All four eye groups use the existing prescription validation.
export const prescriptionUpdateSchema = prescriptionSchema;

export type PurchaseUpdateInput = z.infer<typeof purchaseUpdateSchema>;

export type PrescriptionUpdateInput = z.infer<typeof prescriptionUpdateSchema>;
