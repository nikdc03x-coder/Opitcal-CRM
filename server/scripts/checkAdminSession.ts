
import "dotenv/config";
import { prisma } from "../src/config/database";

// nik - Check Admin sessions without displaying
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
    console.error("Session check failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
