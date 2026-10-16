
/**
 * Optical CRM — Admin Route Protection
 *
 * nik - Protect private API routes using Admin sessions.
 * Keep local development convenient without bypassing
 * authentication in production.
 */

import type {
  Request,
  RequestHandler,
} from "express";

import { getAdminSession } from "../services/authService";
import { readSessionCookie } from "../utils/sessionCookie";

// nik - Only permit the development bypass for
// requests coming directly from this computer.
function allowDevAccess(req: Request): boolean {
  const address = req.socket.remoteAddress;

  const isLocal =
    address === "127.0.0.1" ||
    address === "::1" ||
    address === "::ffff:127.0.0.1";

  return (
    process.env.NODE_ENV === "development" &&
    isLocal
  );
}

// nik - Verify request origin for operations that change data.
function validOrigin(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return true;
  }

  const expected =
    process.env.CLIENT_URL || "http://localhost:5173";

  return req.headers.origin === expected;
}

// nik - Reuse this middleware for customer and catalog APIs.
export const requireAdmin: RequestHandler = async (
  req,
  res,
  next
) => {
  // nik - Preserve fast local development.
  // This condition is false when NODE_ENV is production.
  if (allowDevAccess(req)) {
    next();
    return;
  }

  // nik - Block untrusted requests that modify CRM data.
  if (!validOrigin(req)) {
    res.status(403).json({
      success: false,
      message: "Untrusted request origin.",
    });
    return;
  }

  try {
    // nik - Authenticate using the shared cookie helper.
    const token = readSessionCookie(req);
    const admin = await getAdminSession(token);

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Admin login required.",
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
