import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { databasePoolConfig } from "./databaseConfig";

// One lazy pool for the process, shared by API services and maintenance scripts.
// Prisma owns this adapter's pool and closes it on $disconnect().
const adapter = new PrismaPg(databasePoolConfig(), {
  onPoolError: (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as any)?.code;

    // Routine serverless idle connection recycling by Neon / PgBouncer
    const isRoutineIdleDrop =
      code === "57P01" ||
      code === "ECONNRESET" ||
      /Connection terminated unexpectedly|read ECONNRESET|socket closed|ended by the other party|timeout/i.test(
        message,
      );

    if (isRoutineIdleDrop) {
      // Normal for Neon serverless when pooling drops inactive sockets.
      // node-postgres automatically evicts the dead connection and reconnects on demand.
      if (process.env.DEBUG_NEON_POOL === "true") {
        console.info(
          "[db:neon] Idle connection closed by serverless pooler; will reconnect on demand.",
        );
      }
      return;
    }

    console.warn(`[db:neon] Pool connection notification: ${message}`);
  },
});
export const prisma = new PrismaClient({ adapter });
