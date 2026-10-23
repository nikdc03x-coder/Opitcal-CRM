import { prisma } from "../config/database";
import { hashPassword, verifyPassword } from "./authService";
import { HttpError } from "../utils/errors";

const prefix = "trash-confirmation:";
export const PIN_FAILURE_LIMIT = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

export async function setDeletionPin(adminId: number, pin: string) {
  if (!/^\d{4}$/.test(pin))
    throw new HttpError("Administrator PIN must contain exactly four digits.", 400);
  const pinHash = await hashPassword(prefix + pin);
  await prisma.adminDeletionPin.upsert({
    where: { adminId },
    create: { adminId, pinHash },
    update: { pinHash, failedAttempts: 0, lockedUntil: null },
  });
}

export async function verifyDeletionPin(adminId: number, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new HttpError("Enter a four-digit administrator PIN.", 400);
  const result = await prisma.$transaction(
    async (tx) => {
      // Serialize attempts across browsers, sessions and server processes.
      await tx.$queryRaw`SELECT "adminId" FROM "AdminDeletionPin" WHERE "adminId" = ${adminId} FOR UPDATE`;
      const settings = await tx.adminDeletionPin.findUnique({ where: { adminId } });
      if (!settings) return "unconfigured";
      const now = new Date();
      if (settings.lockedUntil && settings.lockedUntil > now) return "locked";
      if (await verifyPassword(prefix + pin, settings.pinHash)) {
        await tx.adminDeletionPin.update({
          where: { adminId },
          data: { failedAttempts: 0, lockedUntil: null },
        });
        return "verified";
      }
      const attempts = settings.lockedUntil ? 1 : settings.failedAttempts + 1;
      await tx.adminDeletionPin.update({
        where: { adminId },
        data: {
          failedAttempts: attempts,
          lockedUntil: attempts >= PIN_FAILURE_LIMIT ? new Date(now.getTime() + PIN_LOCK_MS) : null,
        },
      });
      return attempts >= PIN_FAILURE_LIMIT ? "locked" : "incorrect";
    },
    { maxWait: 10000, timeout: 15000 },
  );
  // Throw after commit: rolling back here would erase the failed-attempt counter.
  if (result === "unconfigured")
    throw new HttpError(
      "Permanent deletion PIN has not been configured by the administrator.",
      503,
    );
  if (result === "locked")
    throw new HttpError("PIN verification is locked. Try again in 15 minutes.", 429);
  if (result !== "verified") throw new HttpError("Incorrect administrator PIN.", 403);
}
