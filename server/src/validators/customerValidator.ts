import { z } from "zod";

// The search field can contain a partial mobile number.
// A complete mobile number is validated when saving.
export const customerSearchSchema = z.object({
  phone: z
    .string()
    .regex(/^\d{1,10}$/)
    .optional(),
  name: z.string().trim().min(1).max(150).optional(),
});

// PostgreSQL customer IDs are stored as UUID strings.
export const customerIdSchema = z.string().uuid();
