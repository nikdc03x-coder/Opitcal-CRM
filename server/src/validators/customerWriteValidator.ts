
import { z } from "zod";

// nik - Validate incoming customer data before it reaches PostgreSQL.

// Mobile numbers are optional.
const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
  .nullable()
  .optional();

// Check actual calendar dates, including leap years.
// This prevents dates such as 2026-02-30.
function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

// An actual purchase date is optional.
// Null means the shop has not recorded one.
export const purchaseDateSchema = z
  .string()
  .refine(
    isValidCalendarDate,
    "Enter a valid purchase date in YYYY-MM-DD format"
  )
  .nullable()
  .optional();

// Optical measurements can be empty.
const eyeSchema = z
  .object({
    sph: z.number().finite().min(-30).max(30).nullable().optional(),
    cyl: z.number().finite().min(-15).max(15).nullable().optional(),
    axis: z.number().int().min(0).max(180).nullable().optional(),
  })
  .strict();

// Maintain the original optical measurement structure.
export const prescriptionSchema = z
  .object({
    re_dist: eyeSchema.optional(),
    re_near: eyeSchema.optional(),
    le_dist: eyeSchema.optional(),
    le_near: eyeSchema.optional(),
  })
  .strict();

// Only allow valid prices with up to two decimal places.
const amountSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(9999999999.99)
  .refine(
    (value) =>
      Math.abs(value * 100 - Math.round(value * 100)) <
      0.000001,
    "Amount must have at most two decimal places"
  );

// A purchase can use individual rates or total MRP.
export const recordSchema = z.discriminatedUnion(
  "pricingMode",
  [
    z
      .object({
        pricingMode: z.literal("SPLIT"),
        specsType: z.string().trim().max(100).nullable().optional(),
        lensType: z.string().trim().max(100).nullable().optional(),
        frameRate: amountSchema,
        lensRate: amountSchema,
      })
      .strict(),

    z
      .object({
        pricingMode: z.literal("MRP_ONLY"),
        specsType: z.string().trim().max(100).nullable().optional(),
        lensType: z.string().trim().max(100).nullable().optional(),
        mrp: amountSchema,
      })
      .strict(),
  ]
);

// Information shared by Create and Update operations.
const customerFields = z
  .object({
    name: z.string().trim().min(1).max(150),
    mobNumber: phoneSchema,
    gender: z
      .enum(["Male", "Female", "Other"])
      .nullable()
      .optional(),
    reference: z.string().trim().max(255).nullable().optional(),

    // Staff-only notes must never be included in customer PDFs.
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

// CREATE CUSTOMER:
// Purchase date is a top-level field, separate from pricing.
export const createCustomerSchema = customerFields.extend({
  prescription: prescriptionSchema.optional(),
  record: recordSchema,
  purchaseDate: purchaseDateSchema,
});

// UPDATE CUSTOMER:
// Existing historical purchase editing uses its own endpoint.
export const updateCustomerSchema = customerFields
  .partial()
  .extend({
    prescription: prescriptionSchema.optional(),
    record: recordSchema.optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

// Types used by controllers and services.
export type CreateCustomerInput =
  z.infer<typeof createCustomerSchema>;

export type UpdateCustomerInput =
  z.infer<typeof updateCustomerSchema>;

export type PrescriptionInput =
  z.infer<typeof prescriptionSchema>;

export type RecordInput =
  z.infer<typeof recordSchema>;
