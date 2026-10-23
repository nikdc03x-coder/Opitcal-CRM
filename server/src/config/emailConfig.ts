import { HttpError } from "../utils/errors";

type Environment = Record<string, string | undefined>;
export function resetEmailConfig(env: Environment = process.env) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  // Preserve existing Resend deployments; SMTP is an alternative delivery transport.
  if (apiKey && from) return { provider: "resend" as const, apiKey, from };
  const user = env.SMTP_USER?.trim();
  const host = env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const pass = host === "smtp.gmail.com" ? env.SMTP_PASS?.replace(/\s/g, "") : env.SMTP_PASS;
  const port = Number(env.SMTP_PORT || "465");
  if (user && pass && Number.isInteger(port) && port > 0 && port <= 65535) {
    return { provider: "smtp" as const, from: from || user, host, port, user, pass };
  }
  throw new HttpError("Password reset email is unavailable. Contact your administrator.", 503);
}
