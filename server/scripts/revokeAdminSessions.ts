
import "dotenv/config";
import { prisma } from "../src/config/database";

// nik - Invalidate all existing Admin sessions.
// The Admin account and CRM records remain unchanged.
async function main() {
  const result = await prisma.adminSession.deleteMany({
    where: { adminId: 1 },
  });

  console.log(`Revoked ${result.count} Admin session(s).`);
}

main()
  .catch((error) => {
    console.error("Session cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
