import "dotenv/config";
import { Client } from "pg";
import { migrationUrl } from "../../src/config/databaseConfig";

async function main() {
  const client = new Client({
    connectionString: migrationUrl(),
    enableChannelBinding: true,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });
  try {
    await client.connect();
    const result = await client.query(`
      SELECT a.pid, a.state, l.granted, a.application_name
      FROM pg_locks AS l JOIN pg_stat_activity AS a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' ORDER BY l.granted DESC
    `);
    console.table(result.rows);
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Could not inspect Neon advisory locks. Check the direct connection.");
  process.exitCode = 1;
});
