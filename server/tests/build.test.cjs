const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");

test("compiled production app serves health checks, SPA routes, API errors and fails closed", async () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://crm.example.test";
  process.env.DATABASE_URL =
    "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/test?sslmode=verify-full";
  process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const { default: app } = require("../dist/app.js");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Health checks & headers
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).success, true);
    assert.equal(health.headers.get("x-powered-by"), null);
    assert.equal(health.headers.get("cache-control"), "no-store");

    // 2. Direct SPA routes serve index.html for client-side routing
    const spa = await fetch(`${base}/customers`);
    assert.equal(spa.status, 200);
    const html = await spa.text();
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<div id="root"><\/div>/);

    // 3. Unknown API routes return 404 JSON
    const missingApi = await fetch(`${base}/api/missing`);
    assert.equal(missingApi.status, 404);
    assert.equal((await missingApi.json()).success, false);

    // 4. Unauthenticated API access returns 401 JSON
    const unauth = await fetch(`${base}/api/customers`);
    assert.equal(unauth.status, 401);
    assert.equal((await unauth.json()).success, false);

    // 5. Untrusted request origin on mutating endpoint returns 403
    const untrusted = await fetch(`${base}/api/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.test" },
      body: JSON.stringify({ name: "Synthetic" }),
    });
    assert.equal(untrusted.status, 403);

    // 6. Database unavailability returns retryable 503 without leaking credentials
    const { errorHandler } = require("../dist/middleware/errorHandler.js");
    let mockStatus = 0;
    let mockBody = null;
    const mockRes = {
      status(s) {
        mockStatus = s;
        return this;
      },
      json(b) {
        mockBody = b;
        return this;
      },
    };
    errorHandler(
      { code: "P1001", message: "Can't reach database server at secret:pass@host:5432" },
      {},
      mockRes,
      () => {},
    );
    assert.equal(mockStatus, 503);
    assert.equal(mockBody.success, false);
    assert.equal(mockBody.message, "The database is temporarily unavailable. Please try again.");
    assert.equal(JSON.stringify(mockBody).includes("secret:pass"), false);

    // 7. Security config fails closed
    delete process.env.SESSION_SECRET;
    const { sessionSecret } = require("../dist/config/authConfig.js");
    assert.throws(() => sessionSecret(), /SESSION_SECRET must contain/);

    const { clientOrigin } = require("../dist/config/authConfig.js");
    process.env.CLIENT_URL = "http://insecure-http-site.com";
    assert.throws(() => clientOrigin(), /production requires HTTPS/);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
