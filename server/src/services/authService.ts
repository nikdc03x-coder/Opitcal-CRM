import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

import { promisify } from "node:util";
import { prisma } from "../config/database";
import { SESSION_AGE_MS } from "../config/authConfig";
import { hashSessionToken } from "../utils/sessionCookie";

const scrypt = promisify(scryptCallback);

// Existing password hashes remain compatible; raw passwords are never persisted.
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 1024) {
    throw new Error("Password must contain between 12 and 1024 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${key.toString("hex")}`;
}

// Check a password against its saved hash.
export async function verifyPassword(password: string, savedHash: string) {
  if (password.length > 1024 || !/^[0-9a-f]{32}:[0-9a-f]{128}$/i.test(savedHash)) {
    return false;
  }
  const [salt, savedKey] = savedHash.split(":");

  const key = (await scrypt(password, salt, 64)) as Buffer;
  const saved = Buffer.from(savedKey, "hex");

  return timingSafeEqual(key, saved);
}

// Log in with the existing Admin account.
export async function loginAdmin(username: string, password: string, previousToken?: string) {
  const admin = await prisma.admin.findUnique({
    where: { username },
    select: { id: true, username: true, passwordHash: true },
  });

  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return null;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_AGE_MS);
  // Rotate this browser's previous session and remove expired sessions on login,
  // rather than adding cleanup writes to every authenticated request.
  await prisma.$transaction(
    async (tx) => {
      const current = await tx.admin.findUnique({
        where: { id: admin.id },
        select: { passwordHash: true },
      });
      if (!current || current.passwordHash !== admin.passwordHash)
        throw new Error("Credentials changed. Please sign in again.");
      await tx.adminSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: new Date() } },
            ...(previousToken && /^[a-f0-9]{64}$/.test(previousToken)
              ? [{ tokenHash: hashSessionToken(previousToken) }]
              : []),
          ],
        },
      });
      await tx.adminSession.create({
        data: { adminId: admin.id, tokenHash: hashSessionToken(token), expiresAt },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return { token, id: admin.id, username: admin.username, expiresAt };
}

// Verify a login session using PostgreSQL.
export async function getAdminSession(token?: string) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: { expiresAt: true, admin: { select: { id: true, username: true } } },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return { id: session.admin.id, username: session.admin.username, expiresAt: session.expiresAt };
}

// Remove the session when the Admin logs out.
export async function logoutAdmin(token?: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;

  await prisma.adminSession.deleteMany({
    where: { tokenHash: hashSessionToken(token) },
  });
}

export async function resetAdminPassword(adminId: number, passwordHash: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash } });
    await tx.adminSession.deleteMany({ where: { adminId } });
  });
}
