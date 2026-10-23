import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolConfig, migrationUrl } from "../src/config/databaseConfig";
import { TEST_DATABASE_URL } from "./testUtils";

test("database pool is bounded, pooled, certificate verified and has finite timeouts", () => {
  const settings = databasePoolConfig({ DATABASE_URL: TEST_DATABASE_URL, DB_POOL_MAX: "8" });
  assert.equal(settings.max, 8);
  assert.deepEqual(settings.ssl, { rejectUnauthorized: true });
  assert.equal(settings.enableChannelBinding, true);
  assert.equal(settings.connectionTimeoutMillis, 10000);
  assert.equal(settings.query_timeout, 15000);
  assert.equal(settings.idleTimeoutMillis, 120000);
  assert.equal(new URL(settings.connectionString!).searchParams.has("sslmode"), false);
});

test("idle connection reuse remains bounded and can be configured", () => {
  assert.equal(
    databasePoolConfig({ DATABASE_URL: TEST_DATABASE_URL, DB_POOL_IDLE_TIMEOUT_MS: "60000" })
      .idleTimeoutMillis,
    60000,
  );
  for (const DB_POOL_IDLE_TIMEOUT_MS of ["0", "600001", "NaN", "1.5"])
    assert.throws(() =>
      databasePoolConfig({ DATABASE_URL: TEST_DATABASE_URL, DB_POOL_IDLE_TIMEOUT_MS }),
    );
});

test("connection validation rejects legacy stores, non-Neon hosts, unsafe TLS and URL overrides", () => {
  const values = [
    undefined,
    "mongodb://localhost/crm",
    "file:./crm.db",
    "postgresql://user:password@localhost/crm?sslmode=require",
    TEST_DATABASE_URL.replace("-pooler", ""),
    TEST_DATABASE_URL.replace("verify-full", "disable"),
    TEST_DATABASE_URL + "&ssl=false",
    TEST_DATABASE_URL + "&host=localhost",
  ];
  for (const DATABASE_URL of values) assert.throws(() => databasePoolConfig({ DATABASE_URL }));
  for (const DB_POOL_MAX of ["0", "51", "2.5", "many"]) {
    assert.throws(() => databasePoolConfig({ DATABASE_URL: TEST_DATABASE_URL, DB_POOL_MAX }));
  }
});

test("migrations require the direct endpoint of the same Neon database", () => {
  const env = {
    DATABASE_URL: TEST_DATABASE_URL,
    DIRECT_URL: TEST_DATABASE_URL.replace("-pooler", ""),
  };
  const migration = new URL(migrationUrl(env));
  assert.equal(migration.hostname, new URL(env.DIRECT_URL).hostname);
  assert.equal(migration.searchParams.get("sslmode"), "verify-full");
  assert.equal(migration.searchParams.get("connect_timeout"), "30");
  assert.equal(
    new URL(
      migrationUrl({
        ...env,
        DIRECT_URL: env.DIRECT_URL.replace("test:test@", "migration:password@"),
      }),
    ).username,
    "migration",
  );
  assert.throws(() => migrationUrl({ ...env, DIRECT_URL: env.DATABASE_URL }));
  assert.throws(() =>
    migrationUrl({ ...env, DIRECT_URL: env.DIRECT_URL.replace("/test?", "/different?") }),
  );
  assert.throws(() =>
    migrationUrl({ ...env, DIRECT_URL: env.DIRECT_URL.replace("ep-test.", "ep-other.") }),
  );
  assert.throws(() => migrationUrl({ ...env, DIRECT_URL: undefined }));
});
