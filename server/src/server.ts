import "dotenv/config";
import app from "./app";
import { prisma } from "./config/database";
import { sessionSecret } from "./config/authConfig";
import { logError } from "./utils/logError";
import { getShopId } from "./services/shopService";

// Read the port from the environment.
const PORT = Number(process.env.PORT ?? 5000);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535)
  throw new Error("PORT must be between 1 and 65535.");
sessionSecret();

// Start the backend server.
const server = app.listen(PORT, () => {
  console.log(`Optical CRM API running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  // Warm one connection and the shop ID once, without blocking health checks.
  // No periodic keep-awake queries or cached authentication are introduced.
  void getShopId().catch((error) => logError("Database startup warm-up failed", error));
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 15000);
  timeout.unref();
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      logError("Database shutdown failed", error);
      process.exitCode = 1;
    } finally {
      clearTimeout(timeout);
    }
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
