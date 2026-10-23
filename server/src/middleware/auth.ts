import type { Request, RequestHandler } from "express";

import { getAdminSession } from "../services/authService";
import {
  clearSessionCookies,
  readSessionCookie,
  setReadProof,
  validReadProof,
} from "../utils/sessionCookie";
import { clientOrigin } from "../config/authConfig";
import { HttpError } from "../utils/errors";

// Verify request origin for operations that change data.
export function validOrigin(req: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return true;
  }

  const configured = clientOrigin();
  if (req.headers.origin === configured) {
    return true;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    req.headers.origin &&
    /^http:\/\/(localhost|127\.0\.0\.1):517[3-9]$/.test(req.headers.origin)
  ) {
    return true;
  }

  return false;
}

export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  next(validOrigin(req) ? undefined : new HttpError("Untrusted request origin.", 403));
};

// Reuse this middleware for customer and catalog APIs.
export const requireAdmin: RequestHandler = async (req, res, next) => {
  // Block untrusted requests that modify CRM data.
  if (!validOrigin(req)) {
    res.status(403).json({
      success: false,
      message: "Untrusted request origin.",
    });
    return;
  }

  try {
    // Authenticate using the shared cookie helper.
    const token = readSessionCookie(req);
    if (validReadProof(req, token)) {
      next();
      return;
    }
    const admin = await getAdminSession(token);

    if (!admin || !token) {
      clearSessionCookies(res);
      res.status(401).json({
        success: false,
        message: "Admin login required.",
      });
      return;
    }

    setReadProof(res, token, admin.expiresAt);
    res.locals.adminId = admin.id;
    res.locals.adminRole = admin.role;
    next();
  } catch (error) {
    next(error);
  }
};
