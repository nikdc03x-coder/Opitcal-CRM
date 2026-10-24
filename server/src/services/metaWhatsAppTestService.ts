import { prisma } from "../config/database";
import { normalizeWhatsAppNumber } from "./reminderUtils";
import { HttpError } from "../utils/errors";

export interface MetaTestSendOptions {
  attemptId: string;
  adminUsername: string;
}

export interface MetaSendResult {
  success: boolean;
  messageId?: string;
  recipientPhone: string;
  status: "ACCEPTED" | "FAILED";
  error?: string;
}

/**
 * Returns allowed test recipient phone numbers configured in backend environment.
 * Parsed from META_WHATSAPP_TEST_RECIPIENTS (comma-separated, e.g. "919876543210,919123456789").
 */
export function getMetaTestAllowedRecipients(): string[] {
  const raw = process.env.META_WHATSAPP_TEST_RECIPIENTS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const norm = normalizeWhatsAppNumber(s);
      return norm.isValid && norm.normalized ? norm.normalized : s.replace(/\D/g, "");
    });
}

/**
 * Sends a message via Meta WhatsApp Cloud API in META_TEST mode.
 * Strictly guarantees:
 * 1. Zero charges.
 * 2. Only explicitly whitelisted test recipient numbers configured in META_WHATSAPP_TEST_RECIPIENTS are allowed.
 * 3. Never falls back to production or non-whitelisted recipients.
 * 4. Fails safely if credentials or test recipients are missing.
 */
export async function sendMetaCloudApiTest(options: MetaTestSendOptions): Promise<MetaSendResult> {
  const { attemptId, adminUsername } = options;

  const attempt = await prisma.reminderAttempt.findUnique({
    where: { id: attemptId },
    include: {
      sequence: {
        include: {
          customer: {
            include: { consent: true },
          },
          shop: {
            include: { reminderSetting: true },
          },
        },
      },
      template: true,
    },
  });

  if (!attempt) {
    throw new HttpError("Reminder attempt not found", 404);
  }

  // Safety check: Shop mode must be META_TEST
  const mode = attempt.sequence.shop.reminderSetting?.mode || "DISABLED";
  if (mode !== "META_TEST") {
    throw new HttpError(`Sending via Meta Cloud API is blocked because shop mode is ${mode}. Set mode to META_TEST.`, 403);
  }

  // Opt-out / Consent check
  if (attempt.sequence.customer.consent?.status === "OPTED_OUT") {
    throw new HttpError("Cannot send reminder: Customer has opted out of WhatsApp communications.", 400);
  }

  // Normalize phone number
  const norm = normalizeWhatsAppNumber(attempt.recipientPhone);
  if (!norm.isValid || !norm.normalized) {
    await prisma.reminderAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: norm.error || "Invalid phone number",
      },
    });
    return {
      success: false,
      recipientPhone: attempt.recipientPhone,
      status: "FAILED",
      error: norm.error || "Invalid phone number",
    };
  }

  // STRICT TEST RECIPIENT ALLOWLIST CHECK
  const allowedRecipients = getMetaTestAllowedRecipients();
  if (!allowedRecipients.includes(norm.normalized)) {
    const errorMsg = `Server-side test safety block: Recipient ${norm.normalized} is not in META_WHATSAPP_TEST_RECIPIENTS allowlist. Registered test recipients are strictly required.`;
    await prisma.reminderAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: errorMsg,
      },
    });
    throw new HttpError(errorMsg, 403);
  }

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    const errorMsg = "Meta WhatsApp Cloud API credentials (META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID) are not configured on server.";
    await prisma.reminderAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: errorMsg,
      },
    });
    throw new HttpError(errorMsg, 500);
  }

  // In official Meta test mode, we send a text message or approved template to the test number
  // https://graph.facebook.com/v21.0/{phone-number-id}/messages
  try {
    const payload = attempt.template?.metaTemplateName
      ? {
          messaging_product: "whatsapp",
          to: norm.normalized,
          type: "template",
          template: {
            name: attempt.template.metaTemplateName,
            language: { code: attempt.template.languageCode || "en" },
          },
        }
      : {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: norm.normalized,
          type: "text",
          text: {
            preview_url: false,
            body: attempt.messageContent,
          },
        };

    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;

    if (!response.ok || data.error) {
      const errMsg = data.error?.message || `Meta API HTTP ${response.status}`;
      await prisma.reminderAttempt.update({
        where: { id: attemptId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          failureReason: errMsg,
          channel: "META_CLOUD_API_TEST",
        },
      });
      return {
        success: false,
        recipientPhone: norm.normalized,
        status: "FAILED",
        error: errMsg,
      };
    }

    const messageId = data.messages?.[0]?.id;

    // Advance sequence: mark attempt as ACCEPTED / SENT
    await prisma.reminderAttempt.update({
      where: { id: attemptId },
      data: {
        status: "ACCEPTED",
        sentAt: new Date(),
        metaMessageId: messageId,
        channel: "META_CLOUD_API_TEST",
        manualConfirmedBy: `API_TEST:${adminUsername}`,
      },
    });

    return {
      success: true,
      messageId,
      recipientPhone: norm.normalized,
      status: "ACCEPTED",
    };
  } catch (err: any) {
    const errorMsg = err.message || "Network error contacting Meta API";
    await prisma.reminderAttempt.update({
      where: { id: attemptId },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: errorMsg,
        channel: "META_CLOUD_API_TEST",
      },
    });
    return {
      success: false,
      recipientPhone: norm.normalized,
      status: "FAILED",
      error: errorMsg,
    };
  }
}
