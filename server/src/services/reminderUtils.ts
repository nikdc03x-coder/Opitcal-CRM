/**
 * Phone number normalization and validation for WhatsApp in India.
 * Normalizes numbers like "9876543210", "+919876543210", "09876543210", "91 98765 43210"
 * into E.164 without leading plus for WhatsApp click-to-chat / Meta Cloud API (e.g. "919876543210").
 */
export function normalizeWhatsAppNumber(rawPhone: string | null | undefined): {
  isValid: boolean;
  normalized?: string;
  display?: string;
  error?: string;
} {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { isValid: false, error: "Phone number is empty or missing" };
  }

  // Strip spaces, dashes, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // Remove leading '+'
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }

  // Handle leading 0 (common local format in India: 09876543210)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // If 10 digits starting with 6, 7, 8, or 9 (valid Indian mobile)
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return {
      isValid: true,
      normalized: `91${cleaned}`,
      display: `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`,
    };
  }

  // If already 12 digits starting with 91 followed by 6-9
  if (/^91[6-9]\d{9}$/.test(cleaned)) {
    const local = cleaned.slice(2);
    return {
      isValid: true,
      normalized: cleaned,
      display: `+91 ${local.slice(0, 5)} ${local.slice(5)}`,
    };
  }

  return {
    isValid: false,
    error: `Invalid Indian mobile number format: "${rawPhone}"`,
  };
}

/**
 * Calculates the exact 6 calendar months eligibility date after a purchase date.
 * If purchase is 2026-04-15, eligibility is 2026-10-15.
 * Handles month-end pinning (e.g. Oct 31 + 6 months -> April 30).
 */
export function calculateSixMonthEligibility(purchaseDate: Date): Date {
  const d = new Date(purchaseDate);
  const originalDay = d.getUTCDate();

  // Set to 1st of month to avoid overflow skips
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 6);

  // Check how many days are in target month
  const daysInTargetMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Generates an official WhatsApp click-to-chat URL:
 * https://wa.me/<number>?text=<encoded_text>
 */
export function buildWhatsAppClickToChatUrl(phone: string, text: string): string {
  const norm = normalizeWhatsAppNumber(phone);
  const targetNumber = norm.isValid && norm.normalized ? norm.normalized : phone.replace(/\D/g, "");
  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}`;
}

/**
 * Fills variable placeholders in template text.
 * e.g. {{customerName}}, {{shopName}}, {{purchaseDate}}, {{latestSpecs}}
 */
export function renderReminderTemplate(
  bodyTemplate: string,
  variables: {
    customerName: string;
    shopName: string;
    purchaseDate?: string;
    specsType?: string;
    stepNumber?: number;
  },
): string {
  let result = bodyTemplate;
  result = result.replace(
    /\{\{\s*customerName\s*\}\}/g,
    variables.customerName || "Valued Customer",
  );
  const resolvedShopName =
    variables.shopName &&
    !variables.shopName.includes("Demo") &&
    variables.shopName !== "Optical Shop"
      ? variables.shopName
      : "Harshu Chasma Ghar";
  result = result.replace(/\{\{\s*shopName\s*\}\}/g, resolvedShopName);
  result = result.replace(/\{\{\s*purchaseDate\s*\}\}/g, variables.purchaseDate || "6 months ago");
  result = result.replace(/\{\{\s*specsType\s*\}\}/g, variables.specsType || "spectacles");
  result = result.replace(/Optical CRM Demo Shop/g, "Harshu Chasma Ghar");
  return result;
}

/**
 * Standard default templates for Harshu Chasma Ghar
 */
export const DEFAULT_REMINDER_TEMPLATES = [
  {
    stepNumber: 1,
    title: "Initial 6-Month Reminder",
    bodyText:
      "Hello {{customerName}}, greetings from {{shopName}}! It has been 6 months since your last eye checkup on {{purchaseDate}}. We recommend an eye-checkup to ensure your vision and spectacles remain comfortable and clear. Visit us this week for a complimentary vision check!",
  },
  {
    stepNumber: 2,
    title: "Second Follow-Up (Day 3)",
    bodyText:
      "Hi {{customerName}}, gentle follow-up from {{shopName}}. Regular eye checkups help maintain healthy eyes and optimal comfort with your glasses. You can drop by at your convenience for a quick prescription check.",
  },
  {
    stepNumber: 3,
    title: "Final Checkup Notice (Day 6)",
    bodyText:
      "Dear {{customerName}}, this is our final reminder regarding your recommended 6-month eye evaluation from {{shopName}}. Let us know if you'd like to schedule an appointment or stop by our store. Thank you!",
  },
];
