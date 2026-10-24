import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";
import { syncReminderEligibility } from "../services/reminderEligibilityService";
import {
  confirmManualReminderSend,
  advanceSequenceAfterMetaApiSend,
} from "../services/reminderSequenceService";
import {
  sendMetaCloudApiTest,
  getMetaTestAllowedRecipients,
} from "../services/metaWhatsAppTestService";
import {
  verifyMetaWebhookHandshake,
  verifyMetaSignature,
  processMetaWebhookEvent,
} from "../services/metaWhatsAppWebhookService";
import {
  buildWhatsAppClickToChatUrl,
  renderReminderTemplate,
  normalizeWhatsAppNumber,
} from "../services/reminderUtils";
import { HttpError } from "../utils/errors";
import { shopToday } from "../utils/date";

/**
 * Helper to get active shop for request.
 */
async function getShopIdForRequest(req: Request): Promise<string> {
  const shop = await prisma.shop.findFirst({
    select: { id: true },
  });
  if (!shop) {
    throw new HttpError("No shop found in system", 404);
  }
  return shop.id;
}

/**
 * GET /api/reminders/dashboard
 * Returns summary stats, current mode, and counts for Harshu Chasma Ghar dashboard.
 */
export async function getReminderDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = await getShopIdForRequest(req);
    const today = shopToday();

    const [
      setting,
      templates,
      dueCount,
      upcomingCount,
      completedCount,
      pausedCount,
      cancelledCount,
    ] = await Promise.all([
      prisma.shopReminderSetting.findUnique({ where: { shopId } }),
      prisma.reminderTemplate.findMany({ where: { shopId }, orderBy: { stepNumber: "asc" } }),
      prisma.reminderAttempt.count({
        where: {
          sequence: { shopId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          status: "PENDING",
          scheduledFor: { lte: today },
        },
      }),
      prisma.reminderAttempt.count({
        where: {
          sequence: { shopId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          status: "PENDING",
          scheduledFor: { gt: today },
        },
      }),
      prisma.reminderSequence.count({
        where: { shopId, status: "COMPLETED" },
      }),
      prisma.reminderSequence.count({
        where: { shopId, status: "PAUSED" },
      }),
      prisma.reminderSequence.count({
        where: { shopId, status: "CANCELLED" },
      }),
    ]);

    const allowedTestRecipients = getMetaTestAllowedRecipients();

    res.json({
      success: true,
      data: {
        mode: setting?.mode || "DISABLED",
        optOutKeywords: setting?.optOutKeywords || "STOP,UNSUBSCRIBE,CANCEL",
        templates,
        allowedTestRecipients,
        stats: {
          due: dueCount,
          upcoming: upcomingCount,
          completed: completedCount,
          paused: pausedCount,
          cancelled: cancelledCount,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reminders/due
 * Retrieves due reminder attempts ready to be sent (due <= today).
 */
export async function getDueRemindersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = await getShopIdForRequest(req);
    const today = shopToday();

    const dueAttempts = await prisma.reminderAttempt.findMany({
      where: {
        sequence: { shopId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
        status: "PENDING",
        scheduledFor: { lte: today },
      },
      include: {
        sequence: {
          include: {
            customer: {
              include: {
                consent: true,
              },
            },
            purchaseRecord: true,
            shop: true,
          },
        },
        template: true,
      },
      orderBy: { scheduledFor: "asc" },
    });

    const items = dueAttempts.map((att) => {
      const cust = att.sequence.customer;
      const purchase = att.sequence.purchaseRecord;
      const bodyTemplate = att.template?.bodyText || att.messageContent;
      const rendered = renderReminderTemplate(bodyTemplate, {
        customerName: cust.name,
        shopName: att.sequence.shop.name,
        purchaseDate: purchase.purchaseDate
          ? purchase.purchaseDate.toISOString().slice(0, 10)
          : undefined,
        specsType: purchase.specsType || undefined,
        stepNumber: att.stepNumber,
      });

      const clickToChatUrl = buildWhatsAppClickToChatUrl(att.recipientPhone, rendered);
      const phoneNorm = normalizeWhatsAppNumber(att.recipientPhone);

      return {
        attemptId: att.id,
        sequenceId: att.sequenceId,
        stepNumber: att.stepNumber,
        scheduledFor: att.scheduledFor,
        customerId: cust.id,
        customerName: cust.name,
        mobNumber: cust.mobNumber,
        normalizedPhone: phoneNorm.normalized,
        isValidPhone: phoneNorm.isValid,
        phoneError: phoneNorm.error,
        consentStatus: cust.consent?.status || "UNSPECIFIED",
        purchaseDate: purchase.purchaseDate,
        renderedMessage: rendered,
        clickToChatUrl,
      };
    });

    res.json({ success: true, data: items });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reminders/sequences
 * List all sequences with filters and pagination.
 */
export async function getReminderSequencesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = await getShopIdForRequest(req);
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { shopId };
    if (status) {
      where.status = status;
    }
    if (search) {
      where.customer = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { mobNumber: { contains: search } },
        ],
      };
    }

    const sequences = await prisma.reminderSequence.findMany({
      where,
      include: {
        customer: {
          include: { consent: true },
        },
        purchaseRecord: true,
        attempts: {
          orderBy: { stepNumber: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({ success: true, data: sequences });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/sync
 * Manually or crontab-triggered eligibility sync.
 */
export async function syncRemindersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = await getShopIdForRequest(req);
    const result = await syncReminderEligibility({ shopId });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/confirm-manual
 * Mark a manual click-to-chat attempt as sent.
 */
export async function confirmManualSendHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { attemptId } = req.body;
    if (!attemptId) {
      throw new HttpError("attemptId is required", 400);
    }
    const adminUser = (req as any).admin?.username || "staff";
    const result = await confirmManualReminderSend({
      attemptId,
      adminUsername: adminUser,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/send-test
 * Sends via Meta Cloud API in META_TEST mode to approved test recipients only.
 */
export async function sendTestMetaApiHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { attemptId } = req.body;
    if (!attemptId) {
      throw new HttpError("attemptId is required", 400);
    }
    const adminUser = (req as any).admin?.username || "tester";
    const result = await sendMetaCloudApiTest({
      attemptId,
      adminUsername: adminUser,
    });

    if (result.success) {
      await advanceSequenceAfterMetaApiSend(attemptId);
    }

    res.json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/sequences/:id/pause
 */
export async function pauseSequenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new HttpError("ID parameter is required", 400);
    const seq = await prisma.reminderSequence.update({
      where: { id },
      data: {
        status: "PAUSED",
        pausedAt: new Date(),
      },
    });
    res.json({ success: true, data: seq });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/sequences/:id/resume
 */
export async function resumeSequenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new HttpError("ID parameter is required", 400);
    const seq = await prisma.reminderSequence.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        pausedAt: null,
      },
    });
    res.json({ success: true, data: seq });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/sequences/:id/cancel
 */
export async function cancelSequenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new HttpError("ID parameter is required", 400);
    const seq = await prisma.reminderSequence.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "MANUALLY_CANCELLED",
      },
    });
    await prisma.reminderAttempt.updateMany({
      where: { sequenceId: id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    res.json({ success: true, data: seq });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/reminders/settings
 * Updates sending mode and opt-out keywords.
 */
export async function updateReminderSettingsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const shopId = await getShopIdForRequest(req);
    const { mode, optOutKeywords } = req.body;

    if (mode && !["DISABLED", "MANUAL_FREE", "META_TEST"].includes(mode)) {
      throw new HttpError("Invalid WhatsApp mode. Allowed: DISABLED, MANUAL_FREE, META_TEST", 400);
    }

    const updated = await prisma.shopReminderSetting.upsert({
      where: { shopId },
      create: {
        shopId,
        mode: mode || "DISABLED",
        optOutKeywords: optOutKeywords || "STOP,UNSUBSCRIBE,CANCEL",
      },
      update: {
        ...(mode ? { mode } : {}),
        ...(optOutKeywords ? { optOutKeywords } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/reminders/templates/:id
 */
export async function updateReminderTemplateHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new HttpError("ID parameter is required", 400);
    const { title, bodyText, metaTemplateName, isActive } = req.body;

    const updated = await prisma.reminderTemplate.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(bodyText ? { bodyText } : {}),
        ...(metaTemplateName !== undefined ? { metaTemplateName } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/consent
 * Set consent status for a customer.
 */
export async function updateCustomerConsentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { customerId, status, notes } = req.body;
    if (!customerId || !["OPTED_IN", "OPTED_OUT", "UNSPECIFIED"].includes(status)) {
      throw new HttpError(
        "customerId and valid status (OPTED_IN, OPTED_OUT, UNSPECIFIED) are required",
        400,
      );
    }

    const consent = await prisma.customerCommunicationConsent.upsert({
      where: { customerId },
      create: {
        customerId,
        status,
        notes,
        source: "STAFF_DASHBOARD",
        optedInAt: status === "OPTED_IN" ? new Date() : undefined,
        optedOutAt: status === "OPTED_OUT" ? new Date() : undefined,
      },
      update: {
        status,
        notes,
        source: "STAFF_DASHBOARD",
        optedInAt: status === "OPTED_IN" ? new Date() : undefined,
        optedOutAt: status === "OPTED_OUT" ? new Date() : undefined,
      },
    });

    if (status === "OPTED_OUT") {
      // Cancel active sequences
      await prisma.reminderSequence.updateMany({
        where: {
          customerId,
          status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "CUSTOMER_OPT_OUT",
        },
      });
      await prisma.reminderAttempt.updateMany({
        where: { sequence: { customerId }, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }

    res.json({ success: true, data: consent });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reminders/webhook (Meta verification challenge)
 */
export function getMetaWebhookHandler(req: Request, res: Response) {
  const challenge = verifyMetaWebhookHandshake(req.query as any);
  if (challenge) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Forbidden");
  }
}

/**
 * POST /api/reminders/webhook (Meta events: delivery status, inbound STOP)
 */
export async function postMetaWebhookHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const rawSignature = req.headers["x-hub-signature-256"] as string | undefined;
    const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (!verifyMetaSignature(bodyString, rawSignature)) {
      res.status(401).send("Invalid signature");
      return;
    }

    const result = await processMetaWebhookEvent(req.body);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reminders/cron
 * Secured scheduled endpoint intended for GitHub Actions or Render Cron.
 * Protected by Bearer REMINDER_JOB_SECRET.
 */
export async function scheduledCronHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const jobSecret = process.env.REMINDER_JOB_SECRET;

    if (!jobSecret || !authHeader || authHeader !== `Bearer ${jobSecret}`) {
      res.status(401).json({ success: false, message: "Unauthorized cron execution" });
      return;
    }

    const shopId = await getShopIdForRequest(req);
    const result = await syncReminderEligibility({ shopId });
    res.json({
      success: true,
      message: "Scheduled reminder eligibility sync executed successfully",
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
