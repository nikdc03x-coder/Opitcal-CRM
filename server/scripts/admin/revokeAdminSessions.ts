import "dotenv/config";
import { logError } from "../../src/utils/logError";
import { prisma } from "../../src/config/database";

// Invalidate all existing Admin sessions.
// The Admin account and CRM records remain unchanged.
async function main() {
  const result = await prisma.adminSession.deleteMany({
    where: { adminId: 1 },
  });

  console.log(`Revoked ${result.count} Admin session(s).`);
}

main()
  .catch((error) => {
    logError("Session cleanup failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
