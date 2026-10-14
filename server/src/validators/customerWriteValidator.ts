
import { z } from "zod";

// Validate an Indian mobile number when supplied.
// Null is allowed because phone numbers are optional.
const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
  .nullable()
  .optional();

// Prescription measurements can be left blank.
// Null represents an intentionally empty measurement.
const eyeSchema = z.object({
  sph: z.number().finite().min(-30).max(30).nullable().optional(),
  cyl: z.number().finite().min(-15).max(15).nullable().optional(),
  axis: z.number().int().min(0).max(180).nullable().optional(),
}).strict();

// Use names similar to your original MongoDB model.
export const prescriptionSchema = z.object({
  re_dist: eyeSchema.optional(),
  re_near: eyeSchema.optional(),
  le_dist: eyeSchema.optional(),
  le_near: eyeSchema.optional(),
}).strict();

// Store monetary amounts with at most two decimals.
const amountSchema = z.number()
  .finite()
  .nonnegative()
  .max(9999999999.99)
  .refine(
    value =>
      Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    "Amount must have at most two decimal places"
  );

// Support either split pricing or a manually entered MRP.
export const recordSchema = z.discriminatedUnion(
  "pricingMode",
  [
    z.object({
      pricingMode: z.literal("SPLIT"),
      specsType: z.string().trim().max(100).nullable().optional(),
      lensType: z.string().trim().max(100).nullable().optional(),
      frameRate: amountSchema,
      lensRate: amountSchema,
    }).strict(),

    z.object({
      pricingMode: z.literal("MRP_ONLY"),
      specsType: z.string().trim().max(100).nullable().optional(),
      lensType: z.string().trim().max(100).nullable().optional(),
      mrp: amountSchema,
    }).strict(),
  ]
);

// Customer details shared by create and edit operations.
const customerFields = z.object({
  name: z.string().trim().min(1).max(150),
  mobNumber: phoneSchema,
  gender: z.enum(["Male", "Female", "Other"]).nullable().optional(),
  reference: z.string().trim().max(255).nullable().optional(),

  // Private shop notes, never included in customer PDFs.
  notes: z.string().trim().max(5000).nullable().optional(),
}).strict();

// Register one customer with an optional prescription
// and a required purchase-related record.
export const createCustomerSchema = customerFields.extend({
  prescription: prescriptionSchema.optional(),
  record: recordSchema,
});

// When editing, only provided fields are changed.
export const updateCustomerSchema = customerFields
  .partial()
  .extend({
    prescription: prescriptionSchema.optional(),
    record: recordSchema.optional(),
  })
  .refine(data => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// Export all TypeScript types used by MVC services.
export type CreateCustomerInput =
  z.infer<typeof createCustomerSchema>;

export type UpdateCustomerInput =
  z.infer<typeof updateCustomerSchema>;

export type PrescriptionInput =
  z.infer<typeof prescriptionSchema>;

export type RecordInput =
  z.infer<typeof recordSchema>;
