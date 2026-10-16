
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { prisma } from "../src/config/database";
import { hashPassword } from "../src/services/authService";

// nik - Reset the existing Admin password without
// creating or deleting any Admin account.
async function main() {
  const admin = await prisma.admin.findUnique({
    where: { id: 1 },
    select: { id: true, username: true },
  });

  if (!admin) {
    console.log("No Admin account exists.");
    return;
  }

  console.log(`Admin username: ${admin.username}`);

  const rl = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    const password = await rl.question(
      "Enter a NEW password (12+ characters): "
    );

    const confirmation = await rl.question(
      "Confirm your new password: "
    );

    if (password !== confirmation) {
      console.log("Passwords do not match.");
      return;
    }

    // nik - Hash the new password before saving.
    const passwordHash = await hashPassword(password);

   
// nik - Update the Admin password without a transaction.
await prisma.admin.update({
  where: { id: admin.id },
  data: { passwordHash },
});

// nik - Invalidate older login sessions after a password reset.
await prisma.adminSession.deleteMany({
  where: { adminId: admin.id },
});


    console.log("Admin password reset successfully.");
  } finally {
    rl.close();
  }
}

main()
  .catch((error) => {
    console.error("Password reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
