
import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import { promisify } from "node:util";
import { prisma } from "../config/database";

const scrypt = promisify(scryptCallback);

// nik - Sessions last seven days.
const SESSION_DAYS = 7;

// nik - Never store plain passwords or session tokens.
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// nik - Hash passwords before saving them.
export async function hashPassword(password: string) {
  if (password.length < 12) {
    throw new Error("Password must contain at least 12 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;

  return `${salt}:${key.toString("hex")}`;
}

// nik - Check a password against its saved hash.
export async function verifyPassword(
  password: string,
  savedHash: string
) {
  const [salt, savedKey] = savedHash.split(":");

  if (!salt || !/^[0-9a-f]{128}$/i.test(savedKey ?? "")) {
    return false;
  }

  const key = (await scrypt(password, salt, 64)) as Buffer;
  const saved = Buffer.from(savedKey, "hex");

  return timingSafeEqual(key, saved);
}

// nik - Log in with the existing Admin account.
export async function loginAdmin(
  username: string,
  password: string
) {
  const admin = await prisma.admin.findUnique({
    where: { username },
  });

  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return null;
  }

  const token = randomBytes(32).toString("hex");

  await prisma.adminSession.create({
    data: {
      adminId: admin.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(
        Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
      ),
    },
  });

  return { token, username: admin.username };
}

// nik - Verify a login session using PostgreSQL.
export async function getAdminSession(token?: string) {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return { id: session.admin.id, username: session.admin.username };
}

// nik - Remove the session when the Admin logs out.
export async function logoutAdmin(token?: string) {
  if (!token) return;

  await prisma.adminSession.deleteMany({
    where: { tokenHash: hashToken(token) },
  });
}
