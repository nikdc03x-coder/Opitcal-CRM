
import type { Request } from "express";

// nik - Keep the session cookie name in one place.
export const SESSION_COOKIE = "optical_crm_session";

// nik - Read the exact cookie without exposing its value.
export function readSessionCookie(req: Request): string | undefined {
  const cookies = req.headers.cookie?.split(";") ?? [];

  for (const entry of cookies) {
    const separator = entry.indexOf("=");

    if (separator === -1) continue;

    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();

    if (name === SESSION_COOKIE) {
      return value;
    }
  }

  return undefined;
}
