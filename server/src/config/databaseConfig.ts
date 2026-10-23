import type { PoolConfig } from "pg";

type Environment = Record<string, string | undefined>;

export function neonUrl(value: string | undefined, name: string, pooled: boolean): URL {
  if (!value) throw new Error(`${name} is required.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech") ||
    !url.username ||
    !url.password ||
    url.pathname.length < 2
  ) {
    throw new Error(`${name} must connect to a Neon PostgreSQL database with credentials.`);
  }
  if (url.hostname.includes("-pooler.") !== pooled) {
    throw new Error(
      `${name} must use the ${pooled ? "pooled (-pooler)" : "direct (non-pooled)"} Neon endpoint.`,
    );
  }
  if (!["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) {
    throw new Error(`${name} must set sslmode=require or sslmode=verify-full.`);
  }
  for (const key of url.searchParams.keys()) {
    if (!["sslmode", "channel_binding"].includes(key)) {
      throw new Error(
        `${name} contains unsupported connection parameters. Use sslmode and optional channel_binding only.`,
      );
    }
  }
  return url;
}

function boundedInteger(value: string | undefined, fallback: number, max: number, name: string) {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > max) throw new Error(`Invalid ${name}.`);
  return Number(value);
}

export function databasePoolConfig(env: Environment = process.env): PoolConfig {
  const url = neonUrl(env.DATABASE_URL, "DATABASE_URL", true);
  // pg URL SSL parameters override the ssl object. Explicitly verify certificates.
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: true },
    enableChannelBinding: true,
    max: boundedInteger(env.DB_POOL_MAX, 10, 50, "DB_POOL_MAX"),
    connectionTimeoutMillis: boundedInteger(
      env.DB_POOL_CONNECT_TIMEOUT_MS,
      10000,
      60000,
      "DB_POOL_CONNECT_TIMEOUT_MS",
    ),
    idleTimeoutMillis: boundedInteger(
      env.DB_POOL_IDLE_TIMEOUT_MS,
      120000,
      600000,
      "DB_POOL_IDLE_TIMEOUT_MS",
    ),
    query_timeout: boundedInteger(
      env.DB_POOL_QUERY_TIMEOUT_MS,
      15000,
      60000,
      "DB_POOL_QUERY_TIMEOUT_MS",
    ),
    keepAlive: true,
    application_name: "optical-crm",
  };
}

export function migrationUrl(env: Environment = process.env): string {
  const direct = neonUrl(env.DIRECT_URL, "DIRECT_URL", false);
  const pooled = neonUrl(env.DATABASE_URL, "DATABASE_URL", true);
  if (
    pooled.hostname.replace("-pooler.", ".") !== direct.hostname ||
    pooled.pathname !== direct.pathname
  ) {
    throw new Error("DATABASE_URL and DIRECT_URL must target the same Neon database.");
  }
  direct.searchParams.set("sslmode", "verify-full");
  // nik - Allow Neon time to wake up before Prisma's migration connection times out.
  direct.searchParams.set("connect_timeout", "30");
  return direct.toString();
}
