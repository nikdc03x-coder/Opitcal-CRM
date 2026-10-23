import assert from "node:assert/strict";
import test from "node:test";
import { mockPrismaMethod, TEST_DATABASE_URL } from "./testUtils";
import {
  changePasswordSchema,
  resetPasswordSchema,
  userSchema,
} from "../src/validators/accountValidator";

process.env.DATABASE_URL = TEST_DATABASE_URL;

test("account validation enforces password length, confirmation, email and roles", () => {
  assert.equal(
    changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
      confirmation: "short",
    }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({
      token: "a".repeat(64),
      newPassword: "a-long-password",
      confirmation: "different",
    }).success,
    false,
  );
  assert.equal(
    userSchema.safeParse({
      username: "user",
      name: "User",
      email: "invalid",
      role: "ADMIN",
      isActive: true,
    }).success,
    false,
  );
  assert.equal(
    userSchema.safeParse({
      username: "user",
      name: "User",
      email: "user@example.test",
      role: "OWNER",
      isActive: true,
    }).success,
    false,
  );
});

test("inactive accounts cannot sign in or restore a session", async (t) => {
  const { prisma } = await import("../src/config/database");
  const auth = await import("../src/services/authService");
  mockPrismaMethod(t, prisma.admin, "findUnique", async () => ({
    id: 1,
    isActive: false,
    passwordHash: await auth.hashPassword("correct-password"),
  }));
  assert.equal(await auth.loginAdmin("admin", "correct-password"), null);
  mockPrismaMethod(t, prisma.adminSession, "findUnique", async () => ({
    expiresAt: new Date(Date.now() + 100000),
    admin: { id: 1, username: "admin", role: "ADMIN", isActive: false },
  }));
  assert.equal(await auth.getAdminSession("a".repeat(64)), null);
});

test("reset verification rejects malformed, expired and inactive-account tokens", async (t) => {
  const { prisma } = await import("../src/config/database");
  const { validateResetToken } = await import("../src/services/accountService");
  const lookup = mockPrismaMethod(t, prisma.passwordResetToken, "findUnique", async () => null);
  await assert.rejects(validateResetToken("bad"), /invalid or expired/);
  assert.equal(lookup.mock.calls.length, 0);
  await assert.rejects(validateResetToken("a".repeat(64)), /invalid or expired/);
  lookup.mock.mockImplementation(async () => ({
    expiresAt: new Date(Date.now() - 1),
    admin: { isActive: true },
  }));
  await assert.rejects(validateResetToken("a".repeat(64)), /invalid or expired/);
  lookup.mock.mockImplementation(async () => ({
    expiresAt: new Date(Date.now() + 100000),
    admin: { isActive: false },
  }));
  await assert.rejects(validateResetToken("a".repeat(64)), /invalid or expired/);
});

test("last active admin cannot be deactivated or demoted, including by another admin", async (t) => {
  const { prisma } = await import("../src/config/database");
  const { saveUser } = await import("../src/services/accountService");
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({
      $queryRaw: async () => [],
      admin: {
        findUnique: async () => ({ id: 1, isActive: true, role: "ADMIN" }),
        findUniqueOrThrow: async () => ({ id: 1, isActive: true, role: "ADMIN" }),
        count: async () => 1,
        update: () => assert.fail("Last admin must not change"),
      },
    }),
  );
  const input = {
    username: "admin",
    name: "Admin",
    email: "admin@example.test",
    role: "ADMIN" as const,
    isActive: false,
  };
  await assert.rejects(saveUser(1, input, 1), /at least one active administrator/);
  await assert.rejects(
    saveUser(2, { ...input, role: "USER", isActive: true }, 1),
    /at least one active administrator/,
  );
});

test("password change verifies current password and atomically revokes sessions and reset links", async (t) => {
  const { prisma } = await import("../src/config/database");
  const { hashPassword, verifyPassword } = await import("../src/services/authService");
  const { changePassword } = await import("../src/services/accountService");
  const oldHash = await hashPassword("original-password");
  mockPrismaMethod(t, prisma.admin, "findUniqueOrThrow", async () => ({
    id: 1,
    passwordHash: oldHash,
  }));
  await assert.rejects(changePassword(1, "incorrect", "replacement-password"), /incorrect/);
  const calls: string[] = [];
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({
      admin: {
        update: async ({ data }: { data: { passwordHash: string } }) => {
          assert.equal(await verifyPassword("replacement-password", data.passwordHash), true);
          calls.push("password");
        },
      },
      adminSession: {
        deleteMany: async () => {
          calls.push("sessions");
        },
      },
      passwordResetToken: {
        deleteMany: async () => {
          calls.push("tokens");
        },
      },
    }),
  );
  await changePassword(1, "original-password", "replacement-password");
  assert.deepEqual(calls, ["password", "sessions", "tokens"]);
});

test("reset consumption uses an atomic deletion and refuses token reuse", async (t) => {
  const { prisma } = await import("../src/config/database");
  const { completePasswordReset } = await import("../src/services/accountService");
  const reset = {
    id: "reset",
    adminId: 1,
    expiresAt: new Date(Date.now() + 100000),
    admin: { isActive: true },
  };
  mockPrismaMethod(t, prisma.passwordResetToken, "findUnique", async () => reset);
  mockPrismaMethod(t, prisma, "$transaction", async (callback: (tx: unknown) => unknown) =>
    callback({
      passwordResetToken: { findUnique: async () => reset, deleteMany: async () => ({ count: 0 }) },
      admin: { update: () => assert.fail("A consumed token must never change the password") },
    }),
  );
  await assert.rejects(
    completePasswordReset("a".repeat(64), "replacement-password"),
    /invalid or expired/,
  );
});

test("profile saving verifies the password, persists safe details and allows bounded database latency", async (t) => {
  const { prisma } = await import("../src/config/database");
  const { updateProfile } = await import("../src/services/accountService");
  const { hashPassword } = await import("../src/services/authService");
  const passwordHash = await hashPassword("original-password");
  mockPrismaMethod(t, prisma.admin, "findUniqueOrThrow", async () => ({ id: 1, passwordHash }));
  const saved = {
    id: 1,
    name: "Updated Name",
    email: "updated@example.test",
    username: "admin",
    role: "ADMIN",
    isActive: true,
    createdAt: new Date(),
  };
  const operations: string[] = [];
  const transaction = mockPrismaMethod(
    t,
    prisma,
    "$transaction",
    async (
      callback: (tx: unknown) => unknown,
      options: { maxWait: number; timeout: number; isolationLevel: string },
    ) => {
      assert.equal(options.isolationLevel, "Serializable");
      assert.equal(options.maxWait, 10000);
      assert.equal(options.timeout, 20000);
      return callback({
        admin: {
          update: async ({
            where,
            data,
            select,
          }: {
            where: { id: number; passwordHash: string; isActive: boolean };
            data: object;
            select: Record<string, boolean>;
          }) => {
            assert.deepEqual(where, { id: 1, passwordHash, isActive: true });
            assert.deepEqual(data, { name: saved.name, email: saved.email });
            assert.equal(select.passwordHash, undefined);
            operations.push("profile");
            return saved;
          },
        },
        passwordResetToken: {
          deleteMany: async () => {
            operations.push("tokens");
          },
        },
      });
    },
  );
  await assert.rejects(
    updateProfile(1, saved.name, saved.email, "incorrect"),
    /Current password is incorrect/,
  );
  assert.equal(transaction.mock.calls.length, 0);
  assert.deepEqual(await updateProfile(1, saved.name, saved.email, "original-password"), saved);
  assert.deepEqual(operations, ["profile", "tokens"]);
});

test("shared email limits stop recovery before account lookup without exposing membership", async (t) => {
  process.env.RESEND_API_KEY = "test-only";
  process.env.EMAIL_FROM = "test@example.test";
  t.after(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });
  const { prisma } = await import("../src/config/database");
  const { requestPasswordReset } = await import("../src/services/accountService");
  const { hashSessionToken } = await import("../src/utils/sessionCookie");
  mockPrismaMethod(
    t,
    prisma.accountRateLimit,
    "upsert",
    async ({ where }: { where: { key: string } }) => {
      assert.match(where.key, /^[a-f0-9]{64}$/);
      assert.notEqual(where.key, "admin@example.test");
      return { attempts: 4 };
    },
  );
  mockPrismaMethod(t, prisma.accountRateLimit, "deleteMany", async () => ({ count: 0 }));
  mockPrismaMethod(t, prisma.admin, "findUnique", () =>
    assert.fail("A limited request must not look up the account"),
  );
  assert.equal(await requestPasswordReset("admin@example.test"), undefined);
  assert.equal(await requestPasswordReset("unknown@example.test"), undefined);
  assert.equal(hashSessionToken("a").length, 64);
});
