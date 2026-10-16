import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { READ_PROOF_AGE_MS, SESSION_AGE_MS, sessionSecret } from "../config/authConfig";

export const SESSION_COOKIE = "optical_crm_session";
export const READ_PROOF_COOKIE = "optical_crm_read_proof";

export function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };
}

function readCookie(req: Request, name: string): string | undefined {
  const matches = (req.headers.cookie ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : undefined;
}

export function readSessionCookie(req: Request): string | undefined {
  return readCookie(req, SESSION_COOKIE);
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signature(token: string, expiry: string): Buffer {
  return createHmac("sha256", sessionSecret())
    .update(`optical-crm:read:v1:${hashSessionToken(token)}:${expiry}`)
    .digest();
}

// Only an expiry and signature are stored in this proof, never application data.
// It expires within 30 seconds and is never accepted for writes.
export function setReadProof(
  res: Response,
  token: string,
  sessionExpiresAt: Date,
  now = Date.now(),
): void {
  const expiresAt = Math.min(sessionExpiresAt.getTime(), now + READ_PROOF_AGE_MS);
  if (expiresAt <= now) return;
  const expiry = String(expiresAt);
  res.cookie(READ_PROOF_COOKIE, `${expiry}.${signature(token, expiry).toString("hex")}`, {
    ...cookieOptions(),
    maxAge: expiresAt - now,
  });
}

export function validReadProof(req: Request, token: string | undefined, now = Date.now()): boolean {
  if (!["GET", "HEAD"].includes(req.method) || !token || !/^[a-f0-9]{64}$/.test(token))
    return false;
  const proof = readCookie(req, READ_PROOF_COOKIE);
  if (!proof) return false;
  const [expiry, mac, extra] = proof.split(".");
  if (extra !== undefined || !/^\d{13}$/.test(expiry ?? "") || !/^[a-f0-9]{64}$/.test(mac ?? ""))
    return false;
  const expiresAt = Number(expiry);
  if (expiresAt <= now || expiresAt > now + READ_PROOF_AGE_MS) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), signature(token, expiry));
}

export function setSessionCookies(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: Math.min(SESSION_AGE_MS, expiresAt.getTime() - Date.now()),
  });
  setReadProof(res, token, expiresAt);
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
  res.clearCookie(READ_PROOF_COOKIE, cookieOptions());
}
