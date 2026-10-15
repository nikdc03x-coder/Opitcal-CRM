
import { z } from "zod";

import {
  prescriptionSchema,
  recordSchema,
} from "./customerWriteValidator";

// A date must be a real calendar date in YYYY-MM-DD format.
const dateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}, "Enter a valid date in YYYY-MM-DD format");

// Purchase dates may be unknown for imported records.
export const purchaseUpdateSchema = z.object({
  record: recordSchema,
  purchaseDate: dateSchema.nullable(),
}).strict();

// All four eye groups use the existing prescription validation.
export const prescriptionUpdateSchema = prescriptionSchema;

export type PurchaseUpdateInput =
  z.infer<typeof purchaseUpdateSchema>;

export type PrescriptionUpdateInput =
  z.infer<typeof prescriptionUpdateSchema>;
