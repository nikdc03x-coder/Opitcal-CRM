import { z } from "zod";

// Validate customer and catalog data before saving.

// Mobile numbers are optional.
const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
  .nullable()
  .optional();

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const purchaseDateSchema = z
  .string()
  .refine(isValidCalendarDate, "Enter a valid purchase date in YYYY-MM-DD format")
  .nullable()
  .optional();

const eyeSchema = z
  .object({
    sph: z.number().finite().min(-30).max(30).nullable().optional(),
    cyl: z.number().finite().min(-15).max(15).nullable().optional(),
    axis: z.number().int().min(0).max(180).nullable().optional(),
  })
  .strict();

export const prescriptionSchema = z
  .object({
    re_dist: eyeSchema.optional(),
    re_near: eyeSchema.optional(),
    le_dist: eyeSchema.optional(),
    le_near: eyeSchema.optional(),
  })
  .strict();

const amountSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(9999999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "Amount must have at most two decimal places",
  );

// Catalog references are optional, so older customers
// and manually entered purchase names remain supported.
const catalogFields = {
  specsType: z.string().trim().max(100).nullable().optional(),
  lensType: z.string().trim().max(100).nullable().optional(),
  frameCatalogId: z.string().uuid().nullable().optional(),
  lensCatalogId: z.string().uuid().nullable().optional(),
};

// A purchase may use split pricing or total MRP.
export const recordSchema = z
  .discriminatedUnion("pricingMode", [
    z
      .object({
        pricingMode: z.literal("SPLIT"),
        ...catalogFields,
        frameRate: amountSchema.nullable().default(null),
        lensRate: amountSchema.nullable().default(null),
      })
      .strict(),

    z
      .object({
        pricingMode: z.literal("MRP_ONLY"),
        ...catalogFields,
        mrp: amountSchema.nullable().default(null),
      })
      .strict(),
  ])
  .superRefine((record, ctx) => {
    // Each component fits Decimal(12,2), but their sum must fit it too.
    if (
      record.pricingMode === "SPLIT" &&
      Math.round((record.frameRate ?? 0) * 100) + Math.round((record.lensRate ?? 0) * 100) >
        999999999999
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Purchase total must be at most 9999999999.99.",
      });
    }
  });

const ageMessage = "Enter a whole-number age from 0 to 120, or leave it blank.";

// nik - Blank explicitly clears age; an omitted value leaves an existing observation unchanged.
const ageSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z
    .number({ error: ageMessage })
    .int(ageMessage)
    .min(0, ageMessage)
    .max(120, ageMessage)
    .nullable()
    .optional(),
);

const customerFields = z
  .object({
    name: z.string().trim().min(1).max(150),
    mobNumber: phoneSchema,
    gender: z.enum(["Male", "Female", "Other"]).nullable().optional(),
    ageAtRecording: ageSchema,
    reference: z.string().trim().max(255).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

// CREATE CUSTOMER:
// Date remains separate from the purchase record.
export const createCustomerSchema = customerFields.extend({
  prescription: prescriptionSchema.optional(),
  record: recordSchema,
  purchaseDate: purchaseDateSchema,
});

// UPDATE CUSTOMER:
// Existing personal, prescription and record updates
// remain backward compatible.
export const updateCustomerSchema = customerFields
  .partial()
  .extend({
    prescription: prescriptionSchema.optional(),
    record: recordSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

export type RecordInput = z.infer<typeof recordSchema>;
