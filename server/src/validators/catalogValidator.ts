
import { z } from "zod";

// nik - Validate catalog products before saving them.
// Admins can enter their own brands, models and descriptions.

const requiredName = (maximum: number) =>
  z.string().trim().min(1, "This field is required").max(maximum);

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

// Frames: brand, model and optional product information.
export const frameCreateSchema = z.object({
  brand: requiredName(150),
  model: requiredName(150),
  frameCode: optionalText(100),
  frameStyle: optionalText(100),
  description: optionalText(10000),
}).strict();

// Lenses: company, model, vision type and coating.
// Vision type remains customizable for different products.
export const lensCreateSchema = z.object({
  company: requiredName(150),
  lensName: requiredName(150),
  visionType: requiredName(100),
  coating: optionalText(200),
  lensCode: optionalText(100),
  description: optionalText(10000),
}).strict();

// Editing also allows activating or deactivating a product.
export const frameUpdateSchema = frameCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

export const lensUpdateSchema = lensCreateSchema
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field to update"
  );

// Query parameters for catalog lists.
export const catalogListSchema = z.object({
  search: z.string().trim().max(150).optional(),
  includeInactive: z.enum(["true", "false"]).optional(),
}).strict();

// IDs are UUIDs, not names or mobile numbers.
export const catalogIdSchema = z.string().uuid();

export type FrameCreateInput = z.infer<typeof frameCreateSchema>;
export type FrameUpdateInput = z.infer<typeof frameUpdateSchema>;

export type LensCreateInput = z.infer<typeof lensCreateSchema>;
export type LensUpdateInput = z.infer<typeof lensUpdateSchema>;

export type CatalogListInput = z.infer<typeof catalogListSchema>;
