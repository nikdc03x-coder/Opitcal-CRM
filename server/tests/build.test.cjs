const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");

test("compiled production app loads its generated Prisma client and serves health checks", async () => {
  process.env.NODE_ENV = "production";
  process.env.CLIENT_URL = "https://crm.example.test";
  process.env.DATABASE_URL =
    "postgresql://test:test@ep-test-pooler.eu-central-1.aws.neon.tech/test?sslmode=verify-full";
  const { default: app } = require("../dist/app.js");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).success, true);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
