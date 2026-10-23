import assert from "node:assert/strict";
import test from "node:test";
import { loginDestination } from "../../client/src/utils/loginDestination";

test("login destinations preserve private paths, queries and fragments without auth loops or external redirects", () => {
  assert.equal(
    loginDestination("/customers?search=Alex#history"),
    "/customers?search=Alex#history",
  );
  assert.equal(loginDestination("/"), "/");
  for (const value of [
    undefined,
    null,
    123,
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/login",
    "/login/?next=/login",
    "/forgot-password",
    "/reset-password#secret",
    "/path\n",
  ]) {
    assert.equal(loginDestination(value), "/dashboard");
  }
});

test("client shares simultaneous session restoration but rechecks after it completes", async (t) => {
  const { getCurrentAdmin } = await import("../../client/src/services/authApi");
  let finish!: (value: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const request = t.mock.method(globalThis, "fetch", async () => pending);
  const first = getCurrentAdmin();
  const second = getCurrentAdmin();
  assert.equal(first, second);
  assert.equal(request.mock.calls.length, 1);
  finish(Response.json({ success: true, admin: { id: 1, username: "admin" } }));
  assert.deepEqual(await first, { id: 1, username: "admin" });
  request.mock.mockImplementation(async () =>
    Response.json({ success: true, admin: { id: 1, username: "admin" } }),
  );
  await getCurrentAdmin();
  assert.equal(request.mock.calls.length, 2);
});

test("expired sessions return null while database/network failures remain retryable errors", async (t) => {
  const { getCurrentAdmin } = await import("../../client/src/services/authApi");
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ success: false, message: "Admin login required." }, { status: 401 }),
  );
  assert.equal(await getCurrentAdmin(), null);
  request.mock.mockImplementation(async () =>
    Response.json({ success: false, message: "Database unavailable." }, { status: 503 }),
  );
  await assert.rejects(getCurrentAdmin(), /Database unavailable/);
  request.mock.mockImplementation(async () => {
    throw new Error("Network failure");
  });
  await assert.rejects(getCurrentAdmin(), /Cannot connect/);
});

test("shared client requests disable response caching, include cookies and notify the layout on 401", async (t) => {
  const { apiFetch, SESSION_EXPIRED_EVENT } = await import("../../client/src/services/http");
  const target = new EventTarget();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { value: target, configurable: true });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  });
  let expired = 0;
  target.addEventListener(SESSION_EXPIRED_EVENT, () => {
    expired++;
  });
  const request = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 401 }),
  );
  await apiFetch("/api/orders");
  assert.equal(expired, 1);
  const options = request.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(options.credentials, "include");
  assert.equal(options.cache, "no-store");
});
