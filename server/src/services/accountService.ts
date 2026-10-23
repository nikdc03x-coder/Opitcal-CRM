import { randomBytes } from "node:crypto";
import { prisma } from "../config/database";
import { AUTH_TRANSACTION_OPTIONS } from "../config/authConfig";
import type { Prisma } from "../generated/prisma/client";
import { hashPassword, verifyPassword } from "./authService";
import { hashSessionToken } from "../utils/sessionCookie";
import { HttpError } from "../utils/errors";
import { sendResetEmail, requireResetEmailConfig } from "./resetEmailService";
import type { z } from "zod";
import type { userSchema } from "../validators/accountValidator";

export const accountSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;
export const RESET_MESSAGE =
  "If an eligible account exists, a password reset email will be sent. Check your inbox and spam folder.";
const invalidReset = () =>
  new HttpError("This reset link is invalid or expired. Request a new link.");

async function revokeCredentials(tx: Prisma.TransactionClient, adminId: number) {
  await tx.adminSession.deleteMany({ where: { adminId } });
  await tx.passwordResetToken.deleteMany({ where: { adminId } });
}

export async function requestPasswordReset(email: string) {
  requireResetEmailConfig();
  // Persistent, address-based limits work across API workers, including unknown emails.
  const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
  const key = hashSessionToken(`password-reset:${email}:${bucket}`);
  const limit = await prisma.accountRateLimit.upsert({
    where: { key },
    create: { key, expiresAt: new Date((bucket + 1) * 15 * 60 * 1000) },
    update: { attempts: { increment: 1 } },
  });
  await prisma.accountRateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  if (limit.attempts > 3) return;
  const account = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, email: true, isActive: true },
  });
  if (!account?.isActive || !account.email) return;
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const issued = await prisma.$transaction(async (tx) => {
    const current = await tx.admin.findUnique({ where: { id: account.id } });
    if (!current?.isActive || current.email !== email) return false;
    await tx.passwordResetToken.deleteMany({ where: { adminId: account.id } });
    await tx.passwordResetToken.create({
      data: { adminId: account.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    return true;
  }, AUTH_TRANSACTION_OPTIONS);
  if (!issued) return;
  try {
    await sendResetEmail(account.email, token);
  } catch {
    // Never return delivery details, email addresses or reset secrets to the caller/logs.
    await prisma.passwordResetToken.deleteMany({ where: { tokenHash } });
    console.error("Password reset email delivery failed; check email provider configuration.");
  }
}

export async function validateResetToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw invalidReset();
  const reset = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });
  if (!reset || reset.expiresAt <= new Date() || !reset.admin.isActive) throw invalidReset();
  return reset;
}

export async function completePasswordReset(token: string, password: string) {
  await validateResetToken(token);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const reset = await tx.passwordResetToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { admin: true },
    });
    if (!reset || reset.expiresAt <= new Date() || !reset.admin.isActive) throw invalidReset();
    const consumed = await tx.passwordResetToken.deleteMany({
      where: { id: reset.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw invalidReset();
    await tx.admin.update({ where: { id: reset.adminId }, data: { passwordHash } });
    await revokeCredentials(tx, reset.adminId);
  }, AUTH_TRANSACTION_OPTIONS);
}

export async function changePassword(id: number, currentPassword: string, newPassword: string) {
  const account = await prisma.admin.findUniqueOrThrow({ where: { id } });
  if (!(await verifyPassword(currentPassword, account.passwordHash)))
    throw new HttpError("Current password is incorrect.", 403);
  if (await verifyPassword(newPassword, account.passwordHash))
    throw new HttpError("Choose a password different from your current password.");
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({
      where: { id, passwordHash: account.passwordHash, isActive: true },
      data: { passwordHash },
    });
    await revokeCredentials(tx, id);
  }, AUTH_TRANSACTION_OPTIONS);
}

export async function updateProfile(
  id: number,
  name: string,
  email: string,
  currentPassword: string,
) {
  const account = await prisma.admin.findUniqueOrThrow({ where: { id } });
  if (!(await verifyPassword(currentPassword, account.passwordHash)))
    throw new HttpError("Current password is incorrect.", 403);
  return prisma.$transaction(async (tx) => {
    const result = await tx.admin.update({
      where: { id, passwordHash: account.passwordHash, isActive: true },
      data: { name, email },
      select: accountSelect,
    });
    await tx.passwordResetToken.deleteMany({ where: { adminId: id } });
    return result;
  }, AUTH_TRANSACTION_OPTIONS);
}

export async function saveUser(actorId: number, input: z.infer<typeof userSchema>, id?: number) {
  // Invitation-only creation: the user chooses a password through their email link.
  const passwordHash =
    id === undefined ? await hashPassword(randomBytes(48).toString("hex")) : undefined;
  return prisma.$transaction(async (tx) => {
    // Lock accounts in stable order: concurrent admin demotions cannot remove the last admin.
    await tx.$queryRaw`SELECT "id" FROM "admins" ORDER BY "id" FOR UPDATE`;
    const actor = await tx.admin.findUnique({ where: { id: actorId } });
    if (!actor?.isActive || actor.role !== "ADMIN")
      throw new HttpError("Administrator access required.", 403);
    if (id === undefined)
      return tx.admin.create({
        data: { ...input, passwordHash: passwordHash! },
        select: accountSelect,
      });
    const target = await tx.admin.findUniqueOrThrow({ where: { id } });
    if (target.isActive && target.role === "ADMIN" && (!input.isActive || input.role !== "ADMIN")) {
      const count = await tx.admin.count({ where: { role: "ADMIN", isActive: true } });
      if (count <= 1)
        throw new HttpError(
          "Keep at least one active administrator. Create another administrator first.",
          409,
        );
    }
    const updated = await tx.admin.update({ where: { id }, data: input, select: accountSelect });
    if (
      target.role !== input.role ||
      target.isActive !== input.isActive ||
      target.email !== input.email ||
      target.username !== input.username
    )
      await revokeCredentials(tx, id);
    return updated;
  }, AUTH_TRANSACTION_OPTIONS);
}
