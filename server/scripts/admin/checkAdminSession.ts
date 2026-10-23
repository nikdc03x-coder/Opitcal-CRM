import "dotenv/config";
import { logError } from "../../src/utils/logError";
import { prisma } from "../../src/config/database";

// Check Admin sessions without displaying
// passwords, cookies or session token hashes.
async function main() {
  const admin = await prisma.admin.findUnique({
    where: { id: 1 },
    select: { id: true, username: true },
  });

  if (!admin) {
    console.log("No Admin account found.");
    return;
  }

  console.log("Admin account:", admin.username);

  const sessions = await prisma.adminSession.findMany({
    where: { adminId: admin.id },
    select: {
      id: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log("Total sessions:", sessions.length);

  const now = new Date();

  for (const session of sessions) {
    console.log({
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      expired: session.expiresAt <= now,
    });
  }

  console.log("Server time:", now.toISOString());
}

main()
  .catch((error) => {
    logError("Session check failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
