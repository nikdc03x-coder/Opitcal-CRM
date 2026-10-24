import crypto from "node:crypto";
import { prisma } from "../config/database";

export interface WebhookVerificationQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}

/**
 * Validates Meta Webhook handshake challenge.
 */
export function verifyMetaWebhookHandshake(query: WebhookVerificationQuery): string | null {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  const expectedToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  if (!expectedToken) {
    return null;
  }

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return challenge;
  }
  return null;
}

/**
 * Validates Meta HMAC SHA256 signature if app secret is set.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader?: string): boolean {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appSecret) {
    return true; // Optional if secret not provided in development
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const signature = signatureHeader.substring(7);
  const hmac = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(hmac, "hex"));
}

/**
 * Processes delivery status updates from Meta WhatsApp Cloud API webhooks.
 * Updates message status to DELIVERED, SENT, or FAILED.
 * Also checks for inbound opt-out keyword messages (e.g. STOP, UNSUBSCRIBE).
 */
export async function processMetaWebhookEvent(payload: any): Promise<{ handled: boolean; detail?: string }> {
  if (payload.object !== "whatsapp_business_account") {
    return { handled: false, detail: "Not a whatsapp_business_account payload" };
  }

  const entries = payload.entry || [];
  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value;
      if (!value) continue;

      // 1. Handle message statuses (delivered, read, failed, sent)
      const statuses = value.statuses || [];
      for (const st of statuses) {
        const metaId = st.id;
        const statusString = (st.status || "").toLowerCase();

        if (metaId) {
          const attempt = await prisma.reminderAttempt.findUnique({
            where: { metaMessageId: metaId },
          });

          if (attempt) {
            if (statusString === "delivered" || statusString === "read") {
              await prisma.reminderAttempt.update({
                where: { id: attempt.id },
                data: {
                  status: "DELIVERED",
                  deliveredAt: new Date(Number(st.timestamp) * 1000 || Date.now()),
                },
              });
            } else if (statusString === "failed") {
              const errMsg = st.errors?.[0]?.message || st.errors?.[0]?.title || "Meta reported delivery failure";
              await prisma.reminderAttempt.update({
                where: { id: attempt.id },
                data: {
                  status: "FAILED",
                  failedAt: new Date(Number(st.timestamp) * 1000 || Date.now()),
                  failureReason: errMsg,
                },
              });
            }
          }
        }
      }

      // 2. Handle inbound messages for keyword opt-out (STOP, UNSUBSCRIBE, CANCEL)
      const messages = value.messages || [];
      for (const msg of messages) {
        const fromNumber = msg.from; // e.g. "919876543210"
        const textBody = (msg.text?.body || "").trim().toUpperCase();

        if (textBody === "STOP" || textBody === "UNSUBSCRIBE" || textBody === "CANCEL") {
          // Look up customer by mobNumber matching this number
          const cleanPhone = fromNumber.replace(/^91/, "");
          const customer = await prisma.customer.findFirst({
            where: {
              OR: [
                { mobNumber: fromNumber },
                { mobNumber: cleanPhone },
                { mobNumber: `+${fromNumber}` },
                { mobNumber: `+91${cleanPhone}` },
              ],
            },
          });

          if (customer) {
            // Record opt-out
            await prisma.customerCommunicationConsent.upsert({
              where: { customerId: customer.id },
              create: {
                customerId: customer.id,
                status: "OPTED_OUT",
                source: "WHATSAPP_INBOUND_STOP",
                notes: `Customer sent '${textBody}' via WhatsApp`,
                optedOutAt: new Date(),
              },
              update: {
                status: "OPTED_OUT",
                source: "WHATSAPP_INBOUND_STOP",
                notes: `Customer sent '${textBody}' via WhatsApp`,
                optedOutAt: new Date(),
              },
            });

            // Cancel any active sequences
            await prisma.reminderSequence.updateMany({
              where: {
                customerId: customer.id,
                status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED"] },
              },
              data: {
                status: "CANCELLED",
                cancelledAt: new Date(),
                cancellationReason: "CUSTOMER_OPT_OUT",
              },
            });

            await prisma.reminderAttempt.updateMany({
              where: {
                sequence: { customerId: customer.id },
                status: "PENDING",
              },
              data: { status: "CANCELLED" },
            });
          }
        }
      }
    }
  }

  return { handled: true };
}
