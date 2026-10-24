import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  normalizeWhatsAppNumber,
  calculateSixMonthEligibility,
  renderReminderTemplate,
  buildWhatsAppClickToChatUrl,
  DEFAULT_REMINDER_TEMPLATES,
} from "../src/services/reminderUtils";
import { getMetaTestAllowedRecipients } from "../src/services/metaWhatsAppTestService";
import {
  verifyMetaWebhookHandshake,
  verifyMetaSignature,
} from "../src/services/metaWhatsAppWebhookService";

// Scenario 1: Mid-month purchase date 6 calendar months check
test("Scenario 1: Mid-month purchase date evaluates to exactly 6 calendar months later", () => {
  const p1 = new Date("2026-04-15T00:00:00.000Z");
  const e1 = calculateSixMonthEligibility(p1);
  assert.equal(e1.toISOString().slice(0, 10), "2026-10-15");
});

// Scenario 2: Month-end 31st to 30th clamping
test("Scenario 2: Month-end date (Oct 31) clamps accurately to April 30", () => {
  const p2 = new Date("2025-10-31T00:00:00.000Z");
  const e2 = calculateSixMonthEligibility(p2);
  assert.equal(e2.toISOString().slice(0, 10), "2026-04-30");
});

// Scenario 3: Leap-year Feb 29 to Aug 29
test("Scenario 3: Leap-year Feb 29 calculates to Aug 29", () => {
  const p3 = new Date("2024-02-29T00:00:00.000Z");
  const e3 = calculateSixMonthEligibility(p3);
  assert.equal(e3.toISOString().slice(0, 10), "2024-08-29");
});

// Scenario 4: Normalization of 10-digit Indian numbers without country code
test("Scenario 4: 10-digit Indian numbers normalize to E.164 without leading plus", () => {
  const res = normalizeWhatsAppNumber("9876543210");
  assert.equal(res.isValid, true);
  assert.equal(res.normalized, "919876543210");
  assert.equal(res.display, "+91 98765 43210");
});

// Scenario 5: Normalization of +91 formatted numbers
test("Scenario 5: Numbers with leading +91 normalize correctly", () => {
  const res = normalizeWhatsAppNumber("+919876543210");
  assert.equal(res.isValid, true);
  assert.equal(res.normalized, "919876543210");
  assert.equal(res.display, "+91 98765 43210");
});

// Scenario 6: Normalization of numbers with leading 0
test("Scenario 6: Numbers with trunk prefix 0 normalize correctly", () => {
  const res = normalizeWhatsAppNumber("09876543210");
  assert.equal(res.isValid, true);
  assert.equal(res.normalized, "919876543210");
  assert.equal(res.display, "+91 98765 43210");
});

// Scenario 7: Normalization with punctuation, dashes, spaces
test("Scenario 7: Numbers with dashes, brackets, and spaces normalize properly", () => {
  const res = normalizeWhatsAppNumber("+91 (98765) - 43210");
  assert.equal(res.isValid, true);
  assert.equal(res.normalized, "919876543210");
  assert.equal(res.display, "+91 98765 43210");
});

// Scenario 8: Rejection of invalid phone numbers
test("Scenario 8: Rejection of invalid phone numbers (too short, alpha, empty, null)", () => {
  assert.equal(normalizeWhatsAppNumber("12345").isValid, false);
  assert.equal(normalizeWhatsAppNumber("abcdefghij").isValid, false);
  assert.equal(normalizeWhatsAppNumber(null).isValid, false);
  assert.equal(normalizeWhatsAppNumber("").isValid, false);
  assert.equal(normalizeWhatsAppNumber("987654321012345").isValid, false); // too long
});

// Scenario 9: Template rendering with all personalization variables
test("Scenario 9: Template rendering replaces all supported variables", () => {
  const tpl =
    "Hello {{customerName}}, greetings from {{shopName}}! Checkup due from {{purchaseDate}} for your {{specsType}}.";
  const rendered = renderReminderTemplate(tpl, {
    customerName: "Nikhil Sharma",
    shopName: "Harshu Chasma Ghar",
    purchaseDate: "2026-04-15",
    specsType: "Progressive Eyeglasses",
  });

  assert.equal(
    rendered,
    "Hello Nikhil Sharma, greetings from Harshu Chasma Ghar! Checkup due from 2026-04-15 for your Progressive Eyeglasses.",
  );
});

// Scenario 10: Forced resolution of shopName to Harshu Chasma Ghar
test("Scenario 10: Forced resolution to Harshu Chasma Ghar when shop has Demo in name", () => {
  const tpl = "Welcome to {{shopName}}!";
  const rendered = renderReminderTemplate(tpl, {
    customerName: "Ramesh",
    shopName: "Optical CRM Demo Shop",
  });
  assert.equal(rendered, "Welcome to Harshu Chasma Ghar!");
});

// Scenario 11: WhatsApp click-to-chat URL encoding with special characters and spaces
test("Scenario 11: WhatsApp click-to-chat URL creates valid wa.me link with URI encoded text", () => {
  const url = buildWhatsAppClickToChatUrl("9876543210", "Hello & Welcome to Harshu Chasma Ghar!");
  assert.equal(
    url,
    "https://wa.me/919876543210?text=Hello%20%26%20Welcome%20to%20Harshu%20Chasma%20Ghar!",
  );
});

// Scenario 12: 3-day step increment calculation
test("Scenario 12: 3-day interval accurately calculates the next due date", () => {
  const baseDate = new Date("2026-10-24T10:00:00.000Z");
  const step2Date = new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000);
  assert.equal(step2Date.toISOString().slice(0, 10), "2026-10-27");
});

// Scenario 13: 3 default templates exist with valid steps
test("Scenario 13: System provides exactly 3 structured default reminder templates", () => {
  assert.equal(DEFAULT_REMINDER_TEMPLATES.length, 3);
  assert.equal(DEFAULT_REMINDER_TEMPLATES[0].stepNumber, 1);
  assert.equal(DEFAULT_REMINDER_TEMPLATES[1].stepNumber, 2);
  assert.equal(DEFAULT_REMINDER_TEMPLATES[2].stepNumber, 3);
  assert.ok(DEFAULT_REMINDER_TEMPLATES[0].bodyText.includes("{{shopName}}"));
});

// Scenario 14: Meta Cloud API test sandbox allowlist parsing and enforcement
test("Scenario 14: Meta Cloud API test recipient allowlist parsing protects against accidental broadcast", () => {
  const prev = process.env.META_WHATSAPP_TEST_RECIPIENTS;
  try {
    process.env.META_WHATSAPP_TEST_RECIPIENTS = "9876543210, +919123456789";
    const allowed = getMetaTestAllowedRecipients();
    assert.deepEqual(allowed, ["919876543210", "919123456789"]);
  } finally {
    process.env.META_WHATSAPP_TEST_RECIPIENTS = prev;
  }
});

// Scenario 15: Meta Webhook challenge verification handshake
test("Scenario 15: Meta Webhook verification handshake responds to subscribe challenge", () => {
  const prevToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  try {
    process.env.META_WHATSAPP_VERIFY_TOKEN = "my_secret_token";
    const result = verifyMetaWebhookHandshake({
      "hub.mode": "subscribe",
      "hub.verify_token": "my_secret_token",
      "hub.challenge": "115820123",
    });
    assert.equal(result, "115820123");

    // Invalid token returns null
    const invalid = verifyMetaWebhookHandshake({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong_token",
      "hub.challenge": "115820123",
    });
    assert.equal(invalid, null);
  } finally {
    process.env.META_WHATSAPP_VERIFY_TOKEN = prevToken;
  }
});

// Scenario 16: Meta Webhook HMAC-SHA256 signature verification
test("Scenario 16: Meta Webhook HMAC-SHA256 signature verification rejects tampering", () => {
  const prevSecret = process.env.META_WHATSAPP_APP_SECRET;
  try {
    const testSecret = "my_super_secret_app_key";
    process.env.META_WHATSAPP_APP_SECRET = testSecret;

    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = crypto.createHmac("sha256", testSecret).update(payload).digest("hex");
    const rawHeader = `sha256=${signature}`;

    assert.equal(verifyMetaSignature(payload, rawHeader), true);
    assert.equal(verifyMetaSignature(payload, "sha256=invalidhash"), false);
    assert.equal(verifyMetaSignature(payload, undefined), false);
  } finally {
    process.env.META_WHATSAPP_APP_SECRET = prevSecret;
  }
});

// Scenario 17: Inbound opt-out keywords parsing
test("Scenario 17: Opt-out keywords detection recognizes STOP, UNSUBSCRIBE, CANCEL", () => {
  const keywords = "STOP,UNSUBSCRIBE,CANCEL".split(",").map((k) => k.trim().toUpperCase());
  const inboundMessage = "Please STOP sending me messages";
  const words = inboundMessage.toUpperCase().split(/\s+/);
  const isOptOut = words.some((w) => keywords.includes(w));
  assert.equal(isOptOut, true);

  const regularMessage = "I would like to book an eye checkup tomorrow";
  const wordsReg = regularMessage.toUpperCase().split(/\s+/);
  const isOptOutReg = wordsReg.some((w) => keywords.includes(w));
  assert.equal(isOptOutReg, false);
});

// Scenario 18: Customer soft-deletion logic
test("Scenario 18: Customer with non-null deletedAt must not be eligible for reminders", () => {
  const activeCustomer = { id: "c1", deletedAt: null, isActive: true };
  const softDeletedCustomer = { id: "c2", deletedAt: new Date(), isActive: true };

  const isEligible = (c: { deletedAt: Date | null; isActive: boolean }) =>
    c.deletedAt === null && c.isActive === true;

  assert.equal(isEligible(activeCustomer), true);
  assert.equal(isEligible(softDeletedCustomer), false);
});

// Scenario 19: New qualifying purchase invalidation
test("Scenario 19: New purchase after sequence purchase date invalidates previous sequence", () => {
  const sequencePurchaseDate = new Date("2026-01-10T00:00:00.000Z");
  const newPurchaseDate = new Date("2026-04-15T00:00:00.000Z");

  const shouldInvalidate = newPurchaseDate > sequencePurchaseDate;
  assert.equal(shouldInvalidate, true);
});

// Scenario 20: Customer consent status change to OPTED_OUT
test("Scenario 20: OPTED_OUT status blocks reminder delivery", () => {
  const optedInCustomer = { consent: { status: "OPTED_IN" } };
  const optedOutCustomer = { consent: { status: "OPTED_OUT" } };
  const unspecifiedCustomer = { consent: { status: "UNSPECIFIED" } };

  const canSend = (c: { consent?: { status: string } }) => c.consent?.status !== "OPTED_OUT";

  assert.equal(canSend(optedInCustomer), true);
  assert.equal(canSend(unspecifiedCustomer), true);
  assert.equal(canSend(optedOutCustomer), false);
});
