import assert from "node:assert/strict";
import test from "node:test";
import express, { type Request, type Response } from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import {
  READ_PROOF_COOKIE,
  SESSION_COOKIE,
  hashSessionToken,
  readSessionCookie,
  setReadProof,
  validReadProof,
} from "../src/utils/sessionCookie";
import { clientOrigin, READ_PROOF_AGE_MS, sessionSecret } from "../src/config/authConfig";
import { errorHandler } from "../src/middleware/errorHandler";

const token = "a".repeat(64);
const secret = "b".repeat(64);
const req = (cookie: string, method = "GET") => ({ headers: { cookie }, method }) as Request;
function proofCookie(expiresAt: Date, now: number, currentToken = token) {
  let value = "";
  setReadProof(
    {
      cookie: (name: string, proof: string) => {
        value = `${name}=${proof}`;
      },
    } as Response,
    currentToken,
    expiresAt,
    now,
  );
  return value;
}

test("signed read proof rejects tampering, expiry, another token, duplicate cookies and writes", () => {
  process.env.SESSION_SECRET = secret;
  const now = Date.now();
  const proof = proofCookie(new Date(now + 600000), now);
  assert.equal(validReadProof(req(proof), token, now), true);
  assert.equal(validReadProof(req(proof), token, now + READ_PROOF_AGE_MS), false);
  assert.equal(validReadProof(req(proof), "c".repeat(64), now), false);
  assert.equal(validReadProof(req(proof + "0"), token, now), false);
  assert.equal(validReadProof(req(`${proof}; ${proof}`), token, now), false);
  for (const method of ["POST", "PATCH", "DELETE", "PUT"])
    assert.equal(validReadProof(req(proof, method), token, now), false);
  const short = proofCookie(new Date(now + 5000), now);
  assert.equal(validReadProof(req(short), token, now + 5000), false);
  assert.equal(
    readSessionCookie(req(`${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`)),
    undefined,
  );
});

test("production origin and signing-key validation fail closed", () => {
  const saved = {
    NODE_ENV: process.env.NODE_ENV,
    CLIENT_URL: process.env.CLIENT_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
  try {
    process.env.NODE_ENV = "production";
    for (const origin of [
      "http://example.com",
      "https://example.com/path",
      "https://example.com/",
    ]) {
      process.env.CLIENT_URL = origin;
      assert.throws(() => clientOrigin());
    }
    process.env.CLIENT_URL = "https://example.com";
    assert.equal(clientOrigin(), "https://example.com");
    process.env.SESSION_SECRET = "short";
    assert.throws(() => sessionSecret());
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("login, session proofs, read query reduction, immediate write revocation and logout work together", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://crm.example.test";
  process.env.SESSION_SECRET = secret;
  const { prisma } = await import("../src/config/database");
  const auth = await import("../src/services/authService");
  const { requireAdmin } = await import("../src/middleware/auth");
  const { default: authRoutes } = await import("../src/routes/authRoutes");
  const passwordHash = await auth.hashPassword("Correct-password-123");
  let stored: { tokenHash: string; expiresAt: Date } | null = null;
  mockPrismaMethod(t, prisma.admin, "findUnique", async () => ({
    id: 1,
    username: "admin",
    passwordHash,
  }));
  const lookup = mockPrismaMethod(
    t,
    prisma.adminSession,
    "findUnique",
    async ({ where, select }: { where: { tokenHash: string }; select: unknown }) => {
      assert.deepEqual(select, {
        expiresAt: true,
        admin: { select: { id: true, username: true, isActive: true, role: true } },
      });
      return stored && stored.tokenHash === where.tokenHash
        ? { expiresAt: stored.expiresAt, admin: { id: 1, username: "admin" } }
        : null;
    },
  );
  mockPrismaMethod(t, prisma.adminSession, "deleteMany", async () => {
    stored = null;
    return { count: 1 };
  });
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({
      admin: { findUnique: async () => ({ passwordHash }) },
      adminSession: {
        deleteMany: async () => {
          stored = null;
        },
        create: async ({ data }: { data: typeof stored }) => {
          stored = data;
        },
      },
    }),
  );
  const app = express();
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.get("/private", requireAdmin, (_req, res) => res.json({ success: true }));
  app.post("/private", requireAdmin, (_req, res) => res.json({ success: true }));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const origin = { Origin: "https://crm.example.test" };
  try {
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { ...origin, "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "Correct-password-123" }),
    });
    assert.equal(login.status, 200);
    const json = await login.json();
    assert.deepEqual(json.admin, { id: 1, username: "admin" });
    assert.equal(JSON.stringify(json).includes("token"), false);
    const cookies = login.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    for (const cookie of cookies) {
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /Secure/i);
      assert.match(cookie, /SameSite=Strict/i);
    }
    const browserCookies = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
    const rawToken = cookies
      .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))!
      .split(";")[0]
      .split("=")[1];
    assert.equal(stored!.tokenHash, hashSessionToken(rawToken));
    assert.notEqual(stored!.tokenHash, rawToken);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await fetch(`${base}/private`, { headers: { Cookie: browserCookies } })).status,
        200,
      );
    assert.equal(
      lookup.mock.calls.length,
      0,
      "Read requests with a valid proof must not query sessions",
    );
    const expiredProof = proofCookie(
      new Date(Date.now() + 60000),
      Date.now() - READ_PROOF_AGE_MS - 1,
      rawToken,
    );
    const revalidated = await fetch(`${base}/private`, {
      headers: { Cookie: `${SESSION_COOKIE}=${rawToken}; ${expiredProof}` },
    });
    assert.equal(revalidated.status, 200);
    assert.equal(lookup.mock.calls.length, 1, "Expired read proofs must consult Neon");
    assert.ok(
      revalidated.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith(`${READ_PROOF_COOKIE}=`)),
    );
    assert.equal(
      (
        await fetch(`${base}/private`, {
          method: "POST",
          headers: { ...origin, Cookie: browserCookies },
        })
      ).status,
      200,
    );
    assert.equal(lookup.mock.calls.length, 2, "Writes must consult Neon even with a valid proof");
    stored = null;
    assert.equal(
      (await fetch(`${base}/private`, { headers: { Cookie: browserCookies } })).status,
      200,
      "Revoked sessions can read only until the existing proof expires",
    );
    assert.equal(
      (
        await fetch(`${base}/private`, {
          method: "POST",
          headers: { ...origin, Cookie: browserCookies },
        })
      ).status,
      401,
    );
    const revokedRead = await fetch(`${base}/private`, {
      headers: { Cookie: `${SESSION_COOKIE}=${rawToken}; ${READ_PROOF_COOKIE}=invalid` },
    });
    assert.equal(revokedRead.status, 401);
    const logout = await fetch(`${base}/auth/logout`, {
      method: "POST",
      headers: { ...origin, Cookie: browserCookies },
    });
    assert.equal(logout.status, 200);
    assert.equal(logout.headers.getSetCookie().length, 2);
    assert.equal(logout.headers.get("cache-control"), "no-store");
    assert.ok(
      logout.headers.getSetCookie().every((cookie) => cookie.includes("Expires=Thu, 01 Jan 1970")),
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("malformed tokens avoid the database and password reset revokes sessions atomically", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const auth = await import("../src/services/authService");
  mockPrismaMethod(t, prisma.adminSession, "findUnique", () =>
    assert.fail("Malformed tokens must not query Neon"),
  );
  assert.equal(await auth.getAdminSession("invalid"), null);
  const calls: string[] = [];
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({
      admin: {
        update: async () => {
          calls.push("password");
        },
      },
      adminSession: {
        deleteMany: async () => {
          calls.push("revoke");
        },
      },
      passwordResetToken: {
        deleteMany: async () => {
          calls.push("tokens");
        },
      },
    }),
  );
  await auth.resetAdminPassword(1, "new-hash");
  assert.deepEqual(calls, ["password", "revoke", "tokens"]);
});

test("password hashes remain compatible and expired database sessions are rejected", async (t) => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  const { prisma } = await import("../src/config/database");
  const auth = await import("../src/services/authService");
  const hash = await auth.hashPassword("Existing-password-123");
  assert.equal(await auth.verifyPassword("Existing-password-123", hash), true);
  assert.equal(await auth.verifyPassword("Wrong-password", hash), false);
  assert.equal(await auth.verifyPassword("Existing-password-123", hash + ":invalid"), false);
  mockPrismaMethod(t, prisma.adminSession, "findUnique", async () => ({
    expiresAt: new Date(Date.now() - 1),
    admin: { id: 1, username: "admin" },
  }));
  assert.equal(await auth.getAdminSession(token), null);
});
