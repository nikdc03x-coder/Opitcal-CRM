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
  DEFAULT_REMINDER_TEMPLATES,
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
    const search = req.query.search as string | undefined;

    const where: any = {
      sequence: { shopId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      status: "PENDING",
      scheduledFor: { lte: today },
    };

    if (search && search.trim()) {
      where.sequence.customer = {
        OR: [
          { name: { contains: search.trim(), mode: "insensitive" } },
          { mobNumber: { contains: search.trim() } },
        ],
      };
    }

    const dueAttempts = await prisma.reminderAttempt.findMany({
      where,
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
 * POST /api/reminders/send-early
 * Allows staff to send a reminder immediately to ANY customer (even if 6 months hasn't elapsed yet).
 * Prepares or retrieves the active sequence/attempt, marks it due immediately, and generates the click-to-chat URL.
 */
export async function sendEarlyReminderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const shopId = await getShopIdForRequest(req);
    const { customerId } = req.body;

    if (!customerId) {
      throw new HttpError("customerId is required", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, shopId, deletedAt: null, isActive: true },
      include: {
        consent: true,
        records: {
          where: { deletedAt: null },
          orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        reminderSequences: {
          where: { status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            attempts: {
              where: { status: "PENDING" },
              orderBy: { stepNumber: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    if (!customer) {
      throw new HttpError("Active customer not found in this shop", 404);
    }

    if (customer.consent?.status === "OPTED_OUT") {
      throw new HttpError("Customer has opted out of WhatsApp messages", 400);
    }

    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    const shopName = shop?.name || "Harshu Chasma Ghar";
    const latestPurchase = customer.records[0];

    let sequence = customer.reminderSequences[0];
    let pendingAttempt = sequence?.attempts[0];

    // If no active sequence or attempt exists, create one immediately
    if (!sequence) {
      sequence = await prisma.reminderSequence.create({
        data: {
          shopId,
          customerId: customer.id,
          purchaseRecordId: latestPurchase?.id || "",
          status: "IN_PROGRESS",
          currentStep: 1,
          eligibilityDate: new Date(),
        },
        include: {
          attempts: true,
        },
      });
    }

    if (!pendingAttempt) {
      const stepNumber = sequence.currentStep || 1;
      const template = await prisma.reminderTemplate.findUnique({
        where: { shopId_stepNumber: { shopId, stepNumber } },
      });

      const message = renderReminderTemplate(
        template?.bodyText || DEFAULT_REMINDER_TEMPLATES[0].bodyText,
        {
          customerName: customer.name,
          shopName,
          purchaseDate: latestPurchase?.purchaseDate?.toISOString().slice(0, 10),
          specsType: latestPurchase?.specsType || undefined,
          stepNumber,
        },
      );

      pendingAttempt = await prisma.reminderAttempt.create({
        data: {
          sequenceId: sequence.id,
          stepNumber,
          templateId: template?.id,
          status: "PENDING",
          scheduledFor: new Date(), // Due immediately!
          recipientPhone: customer.mobNumber || "",
          messageContent: message,
        },
      });
    } else {
      // Make scheduled date today so it appears in Due table
      pendingAttempt = await prisma.reminderAttempt.update({
        where: { id: pendingAttempt.id },
        data: { scheduledFor: new Date() },
      });
    }

    const bodyTemplate = pendingAttempt.messageContent;
    const rendered = renderReminderTemplate(bodyTemplate, {
      customerName: customer.name,
      shopName,
      purchaseDate: latestPurchase?.purchaseDate?.toISOString().slice(0, 10),
      specsType: latestPurchase?.specsType || undefined,
      stepNumber: pendingAttempt.stepNumber,
    });

    const clickToChatUrl = buildWhatsAppClickToChatUrl(customer.mobNumber || "", rendered);
    const phoneNorm = normalizeWhatsAppNumber(customer.mobNumber || "");

    res.json({
      success: true,
      data: {
        attemptId: pendingAttempt.id,
        sequenceId: sequence.id,
        stepNumber: pendingAttempt.stepNumber,
        scheduledFor: pendingAttempt.scheduledFor,
        customerId: customer.id,
        customerName: customer.name,
        mobNumber: customer.mobNumber,
        normalizedPhone: phoneNorm.normalized,
        isValidPhone: phoneNorm.isValid,
        phoneError: phoneNorm.error,
        consentStatus: customer.consent?.status || "UNSPECIFIED",
        purchaseDate: latestPurchase?.purchaseDate,
        renderedMessage: rendered,
        clickToChatUrl,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reminders/search-customers
 * Search any customer in the shop by name or mobile number to allow immediate sending.
 */
export async function searchCustomersForReminderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const shopId = await getShopIdForRequest(req);
    const q = (req.query.q as string | undefined)?.trim();

    if (!q) {
      res.json({ success: true, data: [] });
      return;
    }

    const customers = await prisma.customer.findMany({
      where: {
        shopId,
        deletedAt: null,
        isActive: true,
        OR: [{ name: { contains: q, mode: "insensitive" } }, { mobNumber: { contains: q } }],
      },
      include: {
        consent: true,
        records: {
          where: { deletedAt: null },
          orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      take: 20,
    });

    const results = customers.map((c) => {
      const phoneNorm = normalizeWhatsAppNumber(c.mobNumber || "");
      const latest = c.records[0];
      return {
        id: c.id,
        name: c.name,
        mobNumber: c.mobNumber,
        normalizedPhone: phoneNorm.normalized,
        isValidPhone: phoneNorm.isValid,
        phoneError: phoneNorm.error,
        consentStatus: c.consent?.status || "UNSPECIFIED",
        latestPurchaseDate: latest?.purchaseDate,
        specsType: latest?.specsType,
      };
    });

    res.json({ success: true, data: results });
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
