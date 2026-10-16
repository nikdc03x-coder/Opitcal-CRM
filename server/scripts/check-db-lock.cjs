
const { Client } = require("pg");
require("dotenv").config();

async function main() {
  // nik - Connect directly to Neon, not through the pooler.
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  try {
    await client.connect();

    // nik - Find database sessions holding advisory locks.
    const result = await client.query(`
      SELECT
        a.pid,
        a.state,
        l.granted,
        a.application_name
      FROM pg_locks AS l
      JOIN pg_stat_activity AS a
        ON a.pid = l.pid
      WHERE l.locktype = 'advisory'
      ORDER BY l.granted DESC;
    `);

    console.table(result.rows);

    if (result.rows.length === 0) {
      console.log("No advisory locks found.");
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Lock check failed:", error.message);
  process.exitCode = 1;
});
