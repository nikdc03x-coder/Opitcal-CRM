import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { prisma } from "../../src/config/database";
import {
  hashPassword,
  loginAdmin,
  getAdminSession,
  logoutAdmin,
} from "../../src/services/authService";

async function main() {
  if (process.argv[2] !== "--verify-configured-database")
    throw new Error("Explicit database verification flag required.");
  const prefix = `migration-check-${randomBytes(12).toString("hex")}`;
  const password = randomBytes(32).toString("hex");
  const existing = await prisma.admin.count();
  let id: number | undefined;
  let session: Awaited<ReturnType<typeof loginAdmin>>;
  let server: import("node:http").Server | undefined;
  try {
    const created = await prisma.admin.create({
      data: {
        username: prefix,
        name: "Temporary migration verification",
        email: `${prefix}@example.invalid`,
        role: "USER",
        passwordHash: await hashPassword(password),
      },
      select: { id: true },
    });
    id = created.id;
    await prisma.admin.update({ where: { id }, data: { name: "Verified account write" } });
    assert.equal(
      (await prisma.admin.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
      "Verified account write",
    );
    session = await loginAdmin(prefix, password);
    assert(session);
    assert.equal((await getAdminSession(session.token))?.id, id);
    const { SESSION_COOKIE } = await import("../../src/utils/sessionCookie.js");
    const app = require("../../src/app").default as import("express").Express;
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    for (const path of ["/api/auth/me", "/api/settings/me"]) {
      const response: Response = await fetch(`${base}${path}`, {
        headers: { Cookie: `${SESSION_COOKIE}=${session.token}` },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).success, true);
    }
    const { clientOrigin } = await import("../../src/config/authConfig.js");
    const profile: Response = await fetch(`${base}/api/settings/me`, {
      method: "PATCH",
      headers: {
        Origin: clientOrigin(),
        Cookie: `${SESSION_COOKIE}=${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Verified API profile save",
        email: `${prefix}@example.invalid`,
        currentPassword: password,
      }),
    });
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).account.name, "Verified API profile save");
    assert.equal(
      (await prisma.admin.findUniqueOrThrow({ where: { id }, select: { name: true } })).name,
      "Verified API profile save",
    );
    const hash = randomBytes(32).toString("hex");
    const reset = await prisma.passwordResetToken.create({
      data: { adminId: id, tokenHash: hash, expiresAt: new Date(Date.now() + 10000) },
    });
    assert.equal(
      (await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: reset.id } })).adminId,
      id,
    );
    await prisma.accountRateLimit.create({
      data: { key: prefix, expiresAt: new Date(Date.now() + 10000) },
    });
    assert.equal(
      (await prisma.accountRateLimit.findUniqueOrThrow({ where: { key: prefix } })).attempts,
      1,
    );
    await logoutAdmin(session.token);
    assert.equal(await getAdminSession(session.token), null);
    console.log(
      "PASS: configured PostgreSQL account create/update/read, Settings profile save and reload, token and rate-limit persistence, login, /auth/me, /settings/me and logout.",
    );
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    // Only synthetic rows created by this invocation are removed; existing rows are untouched.
    if (id !== undefined) await prisma.admin.deleteMany({ where: { id, username: prefix } });
    await prisma.accountRateLimit.deleteMany({ where: { key: prefix } });
    assert.equal(await prisma.admin.count(), existing);
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Account migration verification failed; credential details withheld.");
  process.exitCode = 1;
});
