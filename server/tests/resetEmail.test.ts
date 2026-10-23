import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import nodemailer from "nodemailer";
import { resetEmailConfig } from "../src/config/emailConfig";
import { sendResetEmail } from "../src/services/resetEmailService";

function environment(t: TestContext, values: Record<string, string>) {
  const keys = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASS",
    "CLIENT_URL",
    "NODE_ENV",
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(
    process.env,
    { CLIENT_URL: "https://crm.example.test", NODE_ENV: "production" },
    values,
  );
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("an account email alone cannot configure a sending service", () => {
  assert.throws(
    () => resetEmailConfig({ EMAIL_FROM: "recipient@gmail.com" }),
    /email is unavailable/,
  );
  assert.throws(() => resetEmailConfig({ SMTP_USER: "sender@gmail.com" }), /email is unavailable/);
  assert.throws(
    () =>
      resetEmailConfig({
        SMTP_USER: "sender@gmail.com",
        SMTP_PASS: "test-password",
        SMTP_PORT: "0",
      }),
    /email is unavailable/,
  );
});

test("Gmail defaults use authenticated TLS and accept grouped Google App Passwords", async (t) => {
  environment(t, { SMTP_USER: "sender@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" });
  const config = resetEmailConfig();
  assert.equal(config.provider, "smtp");
  if (config.provider !== "smtp") return;
  assert.equal(config.host, "smtp.gmail.com");
  assert.equal(config.port, 465);
  assert.equal(config.pass, "abcdefghijklmnop");
  let closed = false;
  const transport = t.mock.method(nodemailer, "createTransport", (options: unknown) => {
    const smtp = options as {
      secure: boolean;
      tls: { rejectUnauthorized: boolean };
      logger: boolean;
      auth: { user: string };
    };
    assert.equal(smtp.secure, true);
    assert.equal(smtp.tls.rejectUnauthorized, true);
    assert.equal(smtp.logger, false);
    assert.equal(smtp.auth.user, "sender@gmail.com");
    return {
      sendMail: async (message: { from: string; to: string[]; text: string }) => {
        assert.equal(message.from, "sender@gmail.com");
        assert.deepEqual(message.to, ["recipient@gmail.com"]);
        assert.match(
          message.text,
          new RegExp(`https://crm.example.test/reset-password#${"a".repeat(64)}`),
        );
        return { accepted: ["recipient@gmail.com"], rejected: [] };
      },
      close: () => {
        closed = true;
      },
    } as never;
  });
  await sendResetEmail("recipient@gmail.com", "a".repeat(64));
  assert.equal(transport.mock.calls.length, 1);
  assert.equal(closed, true);
});

test("SMTP submission requires STARTTLS and reports rejected delivery", async (t) => {
  environment(t, {
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USER: "sender@example.test",
    SMTP_PASS: "smtp-password",
  });
  let closed = false;
  t.mock.method(nodemailer, "createTransport", (options: unknown) => {
    const smtp = options as { secure: boolean; requireTLS: boolean };
    assert.equal(smtp.secure, false);
    assert.equal(smtp.requireTLS, true);
    return {
      sendMail: async () => ({ accepted: [], rejected: ["recipient@example.test"] }),
      close: () => {
        closed = true;
      },
    } as never;
  });
  await assert.rejects(sendResetEmail("recipient@example.test", "b".repeat(64)), /delivery failed/);
  assert.equal(closed, true);
});

test("existing Resend delivery stays compatible", async (t) => {
  environment(t, { RESEND_API_KEY: "test-key", EMAIL_FROM: "sender@example.test" });
  const request = t.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-key");
      const body = JSON.parse(String(options?.body));
      assert.equal(body.from, "sender@example.test");
      assert.deepEqual(body.to, ["recipient@example.test"]);
      return Response.json({ id: "test-message" });
    },
  );
  await sendResetEmail("recipient@example.test", "c".repeat(64));
  assert.equal(request.mock.calls.length, 1);
});
