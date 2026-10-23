import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { prisma } from "../../src/config/database";
import { setDeletionPin } from "../../src/services/deletionPinService";
import { logError } from "../../src/utils/logError";

async function main() {
  const quiet = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const rl = createInterface({ input: stdin, output: quiet, terminal: Boolean(stdin.isTTY) });
  try {
    let pin: string;
    let confirmation: string;
    if (stdin.isTTY) {
      stdout.write("Enter new four-digit deletion PIN (hidden): ");
      pin = await rl.question("");
      stdout.write("\nConfirm deletion PIN (hidden): ");
      confirmation = await rl.question("");
      stdout.write("\n");
    } else {
      const lines: string[] = [];
      for await (const line of rl) {
        lines.push(line);
        if (lines.length === 2) break;
      }
      [pin, confirmation] = lines as [string, string];
    }
    if (!pin || pin !== confirmation) throw new Error("PIN confirmation does not match.");
    await setDeletionPin(1, pin);
    console.log("Administrator deletion PIN configured successfully.");
  } finally {
    rl.close();
  }
}
main()
  .catch((error: unknown) => {
    logError("Deletion PIN setup failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
