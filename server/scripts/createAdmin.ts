
import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { prisma } from "../src/config/database";
import { hashPassword } from "../src/services/authService";

// nik - Ask for the Admin username and password in the terminal.
const rl = createInterface({
  input: stdin,
  output: stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  try {
    // nik - Prevent additional Admin accounts.
    const existing = await prisma.admin.findFirst();

    if (existing) {
      console.log("An Admin account already exists.");
      return;
    }

    const username = (await ask("Admin username: ")).trim();
    const password = await ask("Admin password (12+ characters): ");

    if (!username || password.length < 12) {
      console.log("Invalid username or password.");
      return;
    }

    // nik - Store only a secure password hash.
    const passwordHash = await hashPassword(password);

    await prisma.admin.create({
      data: {
        id: 1,
        username,
        passwordHash,
      },
    });

    console.log("Admin account created successfully.");
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
});
