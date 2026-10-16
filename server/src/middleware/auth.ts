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

  return req.headers.origin === clientOrigin();
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
    next();
  } catch (error) {
    next(error);
  }
};
