import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWhatsAppNumber,
  whatsappNumber,
  buildWhatsAppBillMessage,
  buildWhatsAppBillUrl,
  openCustomerWhatsApp,
  canShareFilesDirectly,
} from "../../client/src/utils/customerDocuments";

test("Scenario 1: Valid 10-digit Indian mobile number normalizes with country code 91", () => {
  assert.equal(normalizeWhatsAppNumber("9823456789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("7012345678"), "917012345678");
  assert.equal(normalizeWhatsAppNumber("6234567890"), "916234567890");
  assert.equal(normalizeWhatsAppNumber("8123456789"), "918123456789");
});

test("Scenario 2: Mobile number already containing +91 normalizes without duplicate country code", () => {
  assert.equal(normalizeWhatsAppNumber("+919823456789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("919823456789"), "919823456789");
});

test("Scenario 3: Mobile number containing spaces, dashes, brackets, and prefixes", () => {
  assert.equal(normalizeWhatsAppNumber("+91 98234 56789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("+91-98234-56789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("09823456789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("0091 98234 56789"), "919823456789");
  assert.equal(normalizeWhatsAppNumber("(+91) 98234-56789"), "919823456789");
});

test("Scenario 4: Invalid phone numbers return null and throw in whatsappNumber helper", () => {
  assert.equal(normalizeWhatsAppNumber("12345"), null);
  assert.equal(normalizeWhatsAppNumber("5555555555"), null); // Invalid starting digit for Indian mobile
  assert.equal(normalizeWhatsAppNumber("abcdefghij"), null);
  assert.equal(normalizeWhatsAppNumber("123456789012345"), null);
  assert.throws(() => whatsappNumber("12345"), /valid Indian customer mobile number/);
});

test("Scenario 5: Missing or empty phone numbers return null safely", () => {
  assert.equal(normalizeWhatsAppNumber(null), null);
  assert.equal(normalizeWhatsAppNumber(""), null);
  assert.equal(normalizeWhatsAppNumber(undefined), null);
  assert.equal(normalizeWhatsAppNumber("   "), null);
  assert.throws(() => whatsappNumber(null), /valid Indian customer mobile number/);
});

test("Scenario 6: WhatsApp bill message includes exact customer name and Harshu Chasma Ghar branding", () => {
  const msg1 = buildWhatsAppBillMessage("Rahul Sharma");
  assert.ok(msg1.includes("Hello Rahul Sharma,"));
  assert.ok(msg1.includes("Greetings from Harshu Chasma Ghar."));
  assert.ok(msg1.includes("Please find your purchase bill attached."));
  assert.ok(msg1.includes("Thank you for choosing Harshu Chasma Ghar."));

  // Empty name fallback
  const msg2 = buildWhatsAppBillMessage("");
  assert.ok(msg2.includes("Hello Customer,"));
});

test("Scenario 7: WhatsApp bill URL uses official api.whatsapp.com/send/?phone= endpoint with encoded message", () => {
  const phone = "919823456789";
  const name = "Priya Patel";
  const url = buildWhatsAppBillUrl(phone, name);

  assert.ok(url.startsWith("https://api.whatsapp.com/send/?phone=919823456789&text="));
  assert.ok(url.includes(encodeURIComponent("Hello Priya Patel,")));
  assert.ok(url.includes(encodeURIComponent("Greetings from Harshu Chasma Ghar.")));
  assert.ok(url.includes(encodeURIComponent("Please find your purchase bill attached.")));
  assert.ok(url.includes(encodeURIComponent("Thank you for choosing Harshu Chasma Ghar.")));
});

test("Scenario 8: Verification of correct phone & customer matching for two different customers", () => {
  const customerA = { name: "Anil Kapoor", mobNumber: "9876543210" };
  const customerB = { name: "Sunita Verma", mobNumber: "+91 91234 56780" };

  const phoneA = normalizeWhatsAppNumber(customerA.mobNumber)!;
  const phoneB = normalizeWhatsAppNumber(customerB.mobNumber)!;

  assert.equal(phoneA, "919876543210");
  assert.equal(phoneB, "919123456780");

  const urlA = buildWhatsAppBillUrl(phoneA, customerA.name);
  const urlB = buildWhatsAppBillUrl(phoneB, customerB.name);

  assert.ok(urlA.includes("phone=919876543210"));
  assert.ok(urlA.includes(encodeURIComponent("Hello Anil Kapoor,")));
  assert.ok(!urlA.includes("919123456780"));

  assert.ok(urlB.includes("phone=919123456780"));
  assert.ok(urlB.includes(encodeURIComponent("Hello Sunita Verma,")));
  assert.ok(!urlB.includes("919876543210"));
});

test("Scenario 9: Popup blocker safe target window navigation when targetWindow is provided", () => {
  const fakeWindow = {
    closed: false,
    location: { href: "" },
  };

  openCustomerWhatsApp("9823456789", "Test bill message", fakeWindow as unknown as Window);

  assert.ok(fakeWindow.location.href.startsWith("https://api.whatsapp.com/send/?phone=919823456789&text="));
  assert.ok(fakeWindow.location.href.includes(encodeURIComponent("Test bill message")));
});

test("Scenario 10: DOM anchor dispatch when no target window is passed", () => {
  let clickedHref = "";
  let clickedTarget = "";
  let clickedRel = "";

  const fakeAnchor = {
    set href(val: string) {
      clickedHref = val;
    },
    get href() {
      return clickedHref;
    },
    target: "",
    rel: "",
    click() {
      clickedTarget = this.target;
      clickedRel = this.rel;
    },
    remove() {},
  };

  const fakeDocument = {
    createElement(tag: string) {
      if (tag === "a") return fakeAnchor;
      return {};
    },
    body: {
      appendChild() {},
    },
  };

  const originalDocument = (globalThis as unknown as { document?: unknown }).document;
  (globalThis as unknown as { document?: unknown }).document = fakeDocument;

  try {
    openCustomerWhatsApp("+91 98234 56789", "Attached PDF bill");

    assert.ok(clickedHref.startsWith("https://api.whatsapp.com/send/?phone=919823456789&text="));
    assert.equal(clickedTarget, "_blank");
    assert.equal(clickedRel, "noopener noreferrer");
  } finally {
    (globalThis as unknown as { document?: unknown }).document = originalDocument;
  }
});

test("Scenario 11: canShareFilesDirectly gracefully handles environments without navigator or files support", () => {
  // In node / non-browser environment without navigator
  assert.equal(canShareFilesDirectly(), false);
});
