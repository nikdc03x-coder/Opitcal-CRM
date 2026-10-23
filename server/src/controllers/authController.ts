import type { Request, Response } from "express";
import { loginAdmin, logoutAdmin, getAdminSession } from "../services/authService";
import { loginSchema } from "../validators/authValidator";
import { HttpError } from "../utils/errors";
import {
  readSessionCookie,
  setSessionCookies,
  clearSessionCookies,
  setReadProof,
} from "../utils/sessionCookie";

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = loginSchema.safeParse(req.body);
  if (!credentials.success) throw new HttpError("A valid username and password are required.");
  const { username, password } = credentials.data;
  const session = await loginAdmin(username, password, readSessionCookie(req));
  if (!session) throw new HttpError("Invalid username or password.", 401);
  setSessionCookies(res, session.token, session.expiresAt);
  res.json({ success: true, admin: { id: session.id, username: session.username } });
}

// Identity restoration always consults Neon. The client calls it once per layout mount.
export async function currentAdmin(req: Request, res: Response): Promise<void> {
  const token = readSessionCookie(req);
  const admin = await getAdminSession(token);
  if (!admin || !token) {
    clearSessionCookies(res);
    throw new HttpError("Not logged in.", 401);
  }
  setReadProof(res, token, admin.expiresAt);
  res.json({ success: true, admin: { id: admin.id, username: admin.username } });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await logoutAdmin(readSessionCookie(req));
  clearSessionCookies(res);
  res.json({ success: true, message: "Logged out successfully." });
}
