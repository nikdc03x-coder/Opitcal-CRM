import assert from "node:assert/strict";
import test from "node:test";
import { accountRequest } from "../../client/src/services/accountApi";

test("recovery network failures give an actionable connection error and permit retry", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    accountRequest("/api/auth/forgot-password", "POST", { email: "user@example.test" }),
    /Cannot connect to the CRM server/,
  );
  request.mock.mockImplementation(async () =>
    Response.json({ success: true, message: "Check your email." }),
  );
  assert.equal(
    (await accountRequest("/api/auth/forgot-password", "POST", { email: "user@example.test" }))
      .message,
    "Check your email.",
  );
  const options = request.mock.calls[1].arguments[1] as RequestInit;
  assert.equal(options.credentials, "include");
  assert.equal(options.method, "POST");
  assert(options.signal instanceof AbortSignal);
});

test("recovery preserves safe API errors and handles proxy failures and timeouts", async (t) => {
  const request = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        success: false,
        message: "Password reset email is unavailable. Contact your administrator.",
      },
      { status: 503 },
    ),
  );
  await assert.rejects(
    accountRequest("/api/auth/forgot-password", "POST", {}),
    /Password reset email is unavailable/,
  );
  request.mock.mockImplementation(async () => new Response("Proxy failed", { status: 502 }));
  await assert.rejects(
    accountRequest("/api/auth/forgot-password", "POST", {}),
    /temporarily unavailable/,
  );
  request.mock.mockImplementation(async () => {
    throw new DOMException("Timed out", "TimeoutError");
  });
  await assert.rejects(
    accountRequest("/api/auth/forgot-password", "POST", {}),
    /too long to respond/,
  );
});
