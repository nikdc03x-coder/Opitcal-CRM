import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { Client } from "pg";
import nodemailer from "nodemailer";
import type { Prisma } from "../../src/generated/prisma/client";

// Only this isolated migration-test branch is permitted. Credentials stay in .env.
const host = "ep-raspy-cloud-b4v7r07m.c-6.us-east-2.aws.neon.tech";
if (process.argv[2] !== host)
  throw new Error("Pass the isolated account-test hostname explicitly.");
const direct = new URL(process.env.DIRECT_URL ?? "");
direct.hostname = host;
process.env.DIRECT_URL = direct.toString();
const pooled = new URL(direct);
pooled.hostname = host.replace(".c-6.", "-pooler.c-6.");
process.env.DATABASE_URL = pooled.toString();
process.env.CLIENT_URL = "http://localhost:5173";
process.env.NODE_ENV = "development";
process.env.SESSION_SECRET ||= randomBytes(32).toString("hex");
const smtp = process.argv.includes("--smtp");
if (smtp) {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_USER = "sender@example.test";
  process.env.SMTP_PASS = "isolated-test-password";
} else {
  process.env.RESEND_API_KEY = "isolated-test-provider";
  process.env.EMAIL_FROM = "test@example.test";
}

async function main() {
  const migration = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env: process.env, encoding: "utf8", windowsHide: true, timeout: 90000 },
  );
  if (migration.status !== 0)
    throw new Error(`Test branch migration failed: ${migration.stdout}\n${migration.stderr}`);
  console.log("Isolated branch: Prisma migrations applied.");
  const { prisma } = await import("../../src/config/database.js");
  const { hashPassword } = await import("../../src/services/authService.js");
  const app = require("../../src/app").default as import("express").Express;
  const suffix = randomBytes(6).toString("hex");
  const password = randomBytes(24).toString("hex");
  const replacement = randomBytes(24).toString("hex");
  const admin = await prisma.admin.create({
    data: {
      username: `test-admin-${suffix}`,
      name: "Test Admin",
      email: `admin-${suffix}@example.test`,
      passwordHash: await hashPassword(password),
      role: "ADMIN",
    },
  });
  const ids = [admin.id];
  const emails: { email: string; token: string }[] = [];
  const originalTransport = nodemailer.createTransport;
  if (smtp) {
    // Exercise the SMTP application path without sending fixture mail to real inboxes.
    nodemailer.createTransport = (() => ({
      sendMail: async (message: { to: string[]; text: string }) => {
        emails.push({
          email: message.to[0],
          token: message.text.match(/reset-password#([a-f0-9]{64})/)![1],
        });
        return { accepted: message.to, rejected: [] };
      },
      close: () => {},
    })) as typeof nodemailer.createTransport;
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (input === "https://api.resend.com/emails") {
      const body = JSON.parse(String(options?.body)) as { to: string[]; text: string };
      emails.push({
        email: body.to[0],
        token: body.text.match(/reset-password#([a-f0-9]{64})/)![1],
      });
      return Response.json({ id: "isolated-test-delivery" });
    }
    return originalFetch(input, options);
  };
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  async function request(path: string, method = "GET", body?: unknown, cookie = "") {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Origin: process.env.CLIENT_URL!,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await res.json();
    return {
      res,
      data,
      cookie: res.headers
        .getSetCookie()
        .map((item) => item.split(";")[0])
        .join("; "),
    };
  }
  try {
    const login = await request("/auth/login", "POST", { username: admin.username, password });
    assert.equal(login.res.status, 200);
    const cookie = login.cookie;
    assert.equal((await request("/settings/users")).res.status, 401);
    const own = await request("/settings/me", "GET", undefined, cookie);
    assert.equal(own.data.account.email, admin.email);
    assert.equal(JSON.stringify(own.data).includes("passwordHash"), false);
    const profileData = {
      name: "Updated Test Admin",
      email: admin.email,
      currentPassword: password,
    };
    assert.equal(
      (
        await request(
          "/settings/me",
          "PATCH",
          { ...profileData, currentPassword: "incorrect" },
          cookie,
        )
      ).res.status,
      403,
    );
    const originalTransaction = prisma.$transaction.bind(prisma);
    if (process.argv.includes("--slow-profile")) {
      // Reproduce a delayed database operation inside a real Prisma transaction.
      prisma.$transaction = ((
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options: object,
      ) =>
        originalTransaction(async (tx) => {
          await new Promise((resolve) => setTimeout(resolve, 5500));
          return callback(tx);
        }, options)) as typeof prisma.$transaction;
    }
    let updatedProfile;
    try {
      updatedProfile = await request("/settings/me", "PATCH", profileData, cookie);
    } finally {
      prisma.$transaction = originalTransaction as typeof prisma.$transaction;
    }
    if (updatedProfile.res.status !== 200)
      console.log(
        `Profile update returned HTTP ${updatedProfile.res.status}; account credentials withheld.`,
      );
    assert.equal(updatedProfile.res.status, 200);
    assert.equal(updatedProfile.data.account.name, profileData.name);
    assert.equal(JSON.stringify(updatedProfile.data).includes("passwordHash"), false);
    assert.equal(
      (await request("/settings/me", "GET", undefined, cookie)).data.account.name,
      profileData.name,
    );
    console.log("PASS: profile save, persisted profile reload and current-password verification.");
    const created = await request(
      "/settings/users",
      "POST",
      {
        username: `test-user-${suffix}`,
        name: "Test User",
        email: `user-${suffix}@example.test`,
        role: "USER",
        isActive: true,
      },
      cookie,
    );
    assert.equal(created.res.status, 201);
    const user = created.data.user;
    ids.push(user.id);
    assert.equal(emails.length, 1);
    const invitation = emails[0].token;
    console.log("PASS: login, account profile, invitation and user creation.");
    const storedToken = await prisma.passwordResetToken.findFirstOrThrow({
      where: { adminId: user.id },
    });
    assert.notEqual(storedToken.tokenHash, invitation);
    assert.equal(
      (await request("/auth/reset-password/verify", "POST", { token: invitation })).res.status,
      200,
    );
    assert.equal(
      (
        await request("/auth/reset-password", "POST", {
          token: invitation,
          newPassword: password,
          confirmation: password,
        })
      ).res.status,
      200,
    );
    assert.equal(
      (
        await request("/auth/reset-password", "POST", {
          token: invitation,
          newPassword: password,
          confirmation: password,
        })
      ).res.status,
      400,
    );
    const userLogin = await request("/auth/login", "POST", { username: user.username, password });
    assert.equal(userLogin.res.status, 200);
    assert.equal(
      (await request("/settings/users", "GET", undefined, userLogin.cookie)).res.status,
      403,
    );
    assert.equal((await request("/settings/users", "POST", {}, userLogin.cookie)).res.status, 403);
    assert.equal(
      (await request(`/settings/users/${admin.id}`, "PATCH", {}, userLogin.cookie)).res.status,
      403,
    );
    assert.equal(
      (
        await request(
          "/settings/me/password",
          "POST",
          { currentPassword: "wrong", newPassword: replacement, confirmation: replacement },
          userLogin.cookie,
        )
      ).res.status,
      403,
    );
    assert.equal(
      (
        await request(
          "/settings/me/password",
          "POST",
          { currentPassword: password, newPassword: replacement, confirmation: replacement },
          userLogin.cookie,
        )
      ).res.status,
      200,
    );
    assert.equal(
      (await request("/settings/me", "GET", undefined, userLogin.cookie)).res.status,
      401,
    );
    const newLogin = await request("/auth/login", "POST", {
      username: user.username,
      password: replacement,
    });
    assert.equal(newLogin.res.status, 200);
    const input = {
      username: user.username,
      name: "Updated User",
      email: user.email,
      role: "USER",
      isActive: false,
    };
    assert.equal(
      (await request(`/settings/users/${user.id}`, "PATCH", input, cookie)).res.status,
      200,
    );
    assert.equal(
      (await request("/settings/me", "GET", undefined, newLogin.cookie)).res.status,
      401,
    );
    assert.equal(
      (await request("/auth/login", "POST", { username: user.username, password: replacement })).res
        .status,
      401,
    );
    input.isActive = true;
    assert.equal(
      (await request(`/settings/users/${user.id}`, "PATCH", input, cookie)).res.status,
      200,
    );
    const known = await request("/auth/forgot-password", "POST", { email: admin.email });
    const unknown = await request("/auth/forgot-password", "POST", {
      email: `missing-${suffix}@example.test`,
    });
    assert.deepEqual(known.data, unknown.data);
    assert.equal(known.res.status, unknown.res.status);
    const { hashSessionToken } = await import("../../src/utils/sessionCookie.js");
    const expiredToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        adminId: user.id,
        tokenHash: hashSessionToken(expiredToken),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    assert.equal(
      (await request("/auth/reset-password/verify", "POST", { token: expiredToken })).res.status,
      400,
    );
    const reset = emails.at(-1)!.token;
    const concurrent = await Promise.all(
      [1, 2].map(() =>
        request("/auth/reset-password", "POST", {
          token: reset,
          newPassword: replacement,
          confirmation: replacement,
        }),
      ),
    );
    assert.equal(concurrent.filter((result) => result.res.status === 200).length, 1);
    assert.equal((await request("/settings/me", "GET", undefined, cookie)).res.status, 401);
    const db = new Client({ connectionString: direct.toString() });
    await db.connect();
    try {
      const persisted = await db.query('SELECT "name", "isActive" FROM "admins" WHERE "id" = $1', [
        user.id,
      ]);
      assert.deepEqual(persisted.rows[0], { name: "Updated User", isActive: true });
    } finally {
      await db.end();
    }
    console.log(
      "PASS: existing login, invitations, role restrictions, password change, reset expiry/consumption, concurrent token reuse, deactivation, revocation and PostgreSQL persistence.",
    );
  } finally {
    nodemailer.createTransport = originalTransport;
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.admin.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    "Account integration verification failed. No reset secrets or credentials are logged.",
  );
  if (error instanceof Error)
    console.error(
      error.name,
      error.stack?.split("\n").find((line) => line.includes("verifyAccounts.ts")) ||
        "Migration or connection stage failed.",
    );
  process.exitCode = 1;
});
