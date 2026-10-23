import { clientOrigin } from "../config/authConfig";
import { resetEmailConfig } from "../config/emailConfig";
import nodemailer from "nodemailer";

export function requireResetEmailConfig() {
  return resetEmailConfig();
}

export function createResetEmailTransport() {
  const config = requireResetEmailConfig();
  if (config.provider !== "smtp") throw new Error("SMTP is not configured.");
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function sendResetEmail(email: string, token: string) {
  const config = requireResetEmailConfig();
  // A fragment keeps the secret out of access logs and HTTP Referer headers.
  const link = `${clientOrigin()}/reset-password#${token}`;
  const message = {
    from: config.from,
    to: [email],
    subject: "Reset your Optical CRM password",
    text: `A password reset was requested for your Optical CRM account. Open this link to set your password:\n\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request this, ignore this email.`,
  };
  if (config.provider === "smtp") {
    const transport = createResetEmailTransport();
    try {
      const result = await transport.sendMail(message);
      if (!result.accepted?.length || result.rejected?.length)
        throw new Error("Reset email delivery failed.");
    } finally {
      transport.close();
    }
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Reset email delivery failed.");
}
