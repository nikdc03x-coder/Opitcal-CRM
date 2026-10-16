import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { CatalogSelectionError } from "../src/services/catalogSelection";
import { errorHandler } from "../src/middleware/errorHandler";
import { Prisma } from "../src/generated/prisma/client";

test("production API health, authentication, origin checks and error responses work without a database", async () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://crm.example.test";
  // These requests must never query PostgreSQL.
  process.env.DATABASE_URL =
    "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/test?sslmode=verify-full";
  const { default: app } = await import("../src/app");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    assert.equal((await fetch(`${base}/api/health`)).headers.get("cache-control"), "no-store");
    assert.equal((await fetch(`${base}/api/health`)).headers.get("x-powered-by"), null);
    assert.equal((await fetch(`${base}/api/missing`)).status, 404);
    for (const path of [
      "/api/customers",
      "/api/catalog/frames",
      "/api/dashboard",
      "/api/auth/me",
      "/api/orders",
      "/api/orders/summary",
      "/api/orders/eligible-purchases?customerId=test",
    ]) {
      assert.equal((await fetch(`${base}${path}`)).status, 401, path);
    }
    assert.equal((await fetch(`${base}/api/customers`, { method: "POST" })).status, 403);
    assert.equal((await fetch(`${base}/api/orders/order-1`, { method: "DELETE" })).status, 403);
    assert.equal(
      (
        await fetch(`${base}/api/orders/order-1`, {
          method: "DELETE",
          headers: { Origin: "https://crm.example.test" },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { Origin: "https://crm.example.test", "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      400,
    );
    const malformed = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad json",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, "Invalid JSON body.");
    process.env.NODE_ENV = "development";
    assert.equal(
      (await fetch(`${base}/api/customers`)).status,
      401,
      "Development must also require an authenticated session",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("catalog validation failures return actionable 400 responses", async () => {
  const app = express();
  app.get("/", () => {
    throw new CatalogSelectionError("Selected frame is unavailable or inactive.");
  });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      success: false,
      message: "Selected frame is unavailable or inactive.",
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("database errors are retryable and logs omit credentials and query parameters", async (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const app = express();
  app.get("/", () => {
    throw Object.assign(new Error("postgresql://user:secret@example.test/database"), {
      code: "P1001",
    });
  });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    assert.equal(response.status, 503);
    assert.equal(JSON.stringify(await response.json()).includes("secret"), false);
    assert.equal(JSON.stringify(logged.mock.calls).includes("secret"), false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("missing database migrations return actionable errors without leaking database details", async (t) => {
  const logged = t.mock.method(console, "error", () => {});
  const app = express();
  for (const code of ["P2021", "P2022"]) {
    app.get(`/${code}`, () => {
      throw new Prisma.PrismaClientKnownRequestError("private database schema details", {
        code,
        clientVersion: "7.10.0",
        meta: { column: "Customer.ageAtRecording" },
      });
    });
  }
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    for (const code of ["P2021", "P2022"]) {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/${code}`,
      );
      assert.equal(response.status, 503);
      const result = await response.json();
      assert.equal(result.success, false);
      assert.match(result.message, /apply the pending migrations/);
      assert.equal(JSON.stringify(result).includes("private"), false);
      assert.equal(JSON.stringify(result).includes("Customer.ageAtRecording"), false);
    }
    assert.equal(JSON.stringify(logged.mock.calls).includes("private"), false);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
