import type { RequestHandler } from "express";
import { getAdminSession } from "../services/authService";
import { clearSessionCookies, readSessionCookie } from "../utils/sessionCookie";
import { HttpError } from "../utils/errors";

// Settings never accepts the short-lived read proof: role/status changes take effect immediately.
export const requireAccount: RequestHandler = async (req, res, next) => {
  const account = await getAdminSession(readSessionCookie(req));
  if (!account) {
    clearSessionCookies(res);
    throw new HttpError("Please sign in again.", 401);
  }
  res.locals.account = account;
  next();
};
export const requireAccountAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.account?.role !== "ADMIN")
    throw new HttpError("Administrator access required.", 403);
  next();
};
