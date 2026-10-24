import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWhatsAppNumber,
  calculateSixMonthEligibility,
  renderReminderTemplate,
  buildWhatsAppClickToChatUrl,
} from "../src/services/reminderUtils";
import { getMetaTestAllowedRecipients } from "../src/services/metaWhatsAppTestService";
import {
  verifyMetaWebhookHandshake,
  verifyMetaSignature,
} from "../src/services/metaWhatsAppWebhookService";

test("WhatsApp phone normalization formats Indian mobile numbers to E.164 without leading plus", () => {
  // 10 digits
  assert.deepEqual(normalizeWhatsAppNumber("9876543210"), {
    isValid: true,
    normalized: "919876543210",
    display: "+91 98765 43210",
  });

  // with leading +91
  assert.deepEqual(normalizeWhatsAppNumber("+919876543210"), {
    isValid: true,
    normalized: "919876543210",
    display: "+91 98765 43210",
  });

  // with leading 0
  assert.deepEqual(normalizeWhatsAppNumber("09876543210"), {
    isValid: true,
    normalized: "919876543210",
    display: "+91 98765 43210",
  });

  // with spaces and dashes
  assert.deepEqual(normalizeWhatsAppNumber("+91 98765-43210"), {
    isValid: true,
    normalized: "919876543210",
    display: "+91 98765 43210",
  });

  // invalid numbers
  assert.equal(normalizeWhatsAppNumber("12345").isValid, false);
  assert.equal(normalizeWhatsAppNumber("abcdefghij").isValid, false);
  assert.equal(normalizeWhatsAppNumber(null).isValid, false);
  assert.equal(normalizeWhatsAppNumber("").isValid, false);
});

test("Six calendar months eligibility calculation handles mid-month and month-end dates accurately", () => {
  // Mid month
  const p1 = new Date("2026-04-15T00:00:00.000Z");
  const e1 = calculateSixMonthEligibility(p1);
  assert.equal(e1.toISOString().slice(0, 10), "2026-10-15");

  // Oct 31 -> April 30 (April has 30 days)
  const p2 = new Date("2025-10-31T00:00:00.000Z");
  const e2 = calculateSixMonthEligibility(p2);
  assert.equal(e2.toISOString().slice(0, 10), "2026-04-30");

  // Leap year Feb 29 -> Aug 29
  const p3 = new Date("2024-02-29T00:00:00.000Z");
  const e3 = calculateSixMonthEligibility(p3);
  assert.equal(e3.toISOString().slice(0, 10), "2024-08-29");
});

test("Template rendering replaces variables safely", () => {
  const tpl =
    "Hello {{customerName}}, greetings from {{shopName}}! Checkup due from {{purchaseDate}}.";
  const rendered = renderReminderTemplate(tpl, {
    customerName: "Ramesh Kumar",
    shopName: "Harshu Chasma Ghar",
    purchaseDate: "2026-04-15",
  });

  assert.equal(
    rendered,
    "Hello Ramesh Kumar, greetings from Harshu Chasma Ghar! Checkup due from 2026-04-15.",
  );
});

test("WhatsApp click-to-chat URL creates valid wa.me link with URI encoded text", () => {
  const url = buildWhatsAppClickToChatUrl("9876543210", "Hello Ramesh!");
  assert.equal(url, "https://wa.me/919876543210?text=Hello%20Ramesh!");
});

test("Meta Cloud API test recipient allowlist parsing protects against accidental broadcast", () => {
  const prev = process.env.META_WHATSAPP_TEST_RECIPIENTS;
  try {
    process.env.META_WHATSAPP_TEST_RECIPIENTS = "9876543210, +919123456789";
    const allowed = getMetaTestAllowedRecipients();
    assert.deepEqual(allowed, ["919876543210", "919123456789"]);
  } finally {
    process.env.META_WHATSAPP_TEST_RECIPIENTS = prev;
  }
});

test("Meta Webhook verification handshake responds to subscribe challenge", () => {
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
