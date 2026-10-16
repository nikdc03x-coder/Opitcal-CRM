
/**
 * Optical CRM — Admin Authentication Routes
 *
 * nik - Handle login, session verification and logout.
 * PostgreSQL stores the Admin sessions.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

import {
  loginAdmin,
  logoutAdmin,
  getAdminSession,
} from "../services/authService";

import {
  SESSION_COOKIE,
  readSessionCookie,
} from "../utils/sessionCookie";

const router = Router();

// nik - Admin sessions expire after seven days.
const SESSION_AGE = 7 * 24 * 60 * 60 * 1000;

// nik - Block repeated login attempts from the same IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many login attempts. Try again in 15 minutes.",
  },
});

// nik - Protect the session token from browser JavaScript.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
}

// nik - Only accept changes from our configured frontend.
function trustedOrigin(req: Request): boolean {
  const expected =
    process.env.CLIENT_URL || "http://localhost:5173";

  return req.headers.origin === expected;
}

// -----------------------------------------------------
// 1. ADMIN LOGIN
// -----------------------------------------------------

router.post(
  "/login",
  loginLimiter,
  async (req: Request, res: Response) => {
    if (!trustedOrigin(req)) {
      res.status(403).json({
        success: false,
        message: "Untrusted request origin.",
      });
      return;
    }

    const { username, password } = req.body ?? {};

    // nik - Reject missing or invalid credentials.
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Username and password are required.",
      });
      return;
    }

    try {
      // nik - Verify credentials and create a database session.
      const session = await loginAdmin(
        username.trim(),
        password
      );

      if (!session) {
        res.status(401).json({
          success: false,
          message: "Invalid username or password.",
        });
        return;
      }

      // nik - Store the token in a secure session cookie.
      res.cookie(SESSION_COOKIE, session.token, {
        ...cookieOptions(),
        maxAge: SESSION_AGE,
      });

      res.json({
        success: true,
        admin: {
          username: session.username,
        },
      });
    } catch (error) {
      console.error("Admin login failed:", error);

      res.status(500).json({
        success: false,
        message: "Login failed. Please try again.",
      });
    }
  }
);

// -----------------------------------------------------
// 2. VERIFY CURRENT SESSION
// -----------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  try {
    // nik - Read the cookie and check its PostgreSQL session.
    const token = readSessionCookie(req);
    const admin = await getAdminSession(token);

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Not logged in.",
      });
      return;
    }

    // nik - Never return a password or session token.
    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error("Session verification failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify session.",
    });
  }
});

// -----------------------------------------------------
// 3. ADMIN LOGOUT
// -----------------------------------------------------

router.post("/logout", async (req: Request, res: Response) => {
  if (!trustedOrigin(req)) {
    res.status(403).json({
      success: false,
      message: "Untrusted request origin.",
    });
    return;
  }

  try {
    // nik - Invalidate the current session in PostgreSQL.
    await logoutAdmin(readSessionCookie(req));

    // nik - Remove the cookie from the browser.
    res.clearCookie(SESSION_COOKIE, cookieOptions());

    res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Admin logout failed:", error);

    res.status(500).json({
      success: false,
      message: "Logout failed.",
    });
  }
});

export default router;
