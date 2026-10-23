import "dotenv/config";
import { resetEmailConfig } from "../../src/config/emailConfig";
import { createResetEmailTransport } from "../../src/services/resetEmailService";

// Report configuration presence only. Never print email credentials.
console.log(
  JSON.stringify(
    {
      resend: {
        apiKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
        senderConfigured: Boolean(process.env.EMAIL_FROM?.trim()),
      },
      smtp: {
        hostConfigured: Boolean(process.env.SMTP_HOST?.trim()),
        userConfigured: Boolean(process.env.SMTP_USER?.trim()),
        passwordConfigured: Boolean(process.env.SMTP_PASS?.trim()),
      },
    },
    null,
    2,
  ),
);

async function main() {
  let config;
  try {
    config = resetEmailConfig();
  } catch {
    console.error(
      "No email sender is configured. Set SMTP_USER and SMTP_PASS for Gmail (Google App Password), or RESEND_API_KEY and EMAIL_FROM for Resend in server/.env. Restart the API after changing .env.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Email transport configured: ${config.provider}.`);
  if (process.argv.includes("--verify") && config.provider === "smtp") {
    const transport = createResetEmailTransport();
    try {
      await transport.verify();
      console.log("SMTP connection and authentication verified. No email was sent.");
    } catch {
      console.error(
        "SMTP verification failed. Check network access, the sender address and App Password. Credentials are not logged.",
      );
      process.exitCode = 1;
    } finally {
      transport.close();
    }
  }
}
void main();
