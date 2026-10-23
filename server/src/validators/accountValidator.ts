import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12, "Use at least 12 characters.").max(1024);
export const passwordSchema = z
  .object({
    newPassword: password,
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    message: "Passwords do not match.",
  });
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    newPassword: password,
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    message: "Passwords do not match.",
  });
export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    newPassword: password,
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    message: "Passwords do not match.",
  });
export const userSchema = z.object({
  username: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  role: z.enum(["ADMIN", "USER"]),
  isActive: z.boolean(),
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  currentPassword: z.string().min(1).max(1024),
});
