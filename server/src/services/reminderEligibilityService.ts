import { prisma } from "../config/database";
import { calculateSixMonthEligibility, DEFAULT_REMINDER_TEMPLATES } from "./reminderUtils";
import { shopToday } from "../utils/date";

export interface SyncReminderOptions {
  shopId: string;
  referenceDate?: Date; // Defaults to shopToday()
}

export interface SyncReminderResult {
  shopId: string;
  referenceDate: string;
  sequencesCreated: number;
  sequencesCancelledNewPurchase: number;
  sequencesCancelledOptOut: number;
  sequencesCancelledSoftDelete: number;
  dueRemindersCount: number;
}

/**
 * Ensures default templates and settings exist for a shop.
 */
export async function ensureShopReminderDefaults(shopId: string) {
  // Ensure ShopReminderSetting
  await prisma.shopReminderSetting.upsert({
    where: { shopId },
    create: {
      shopId,
      mode: "DISABLED", // default zero cost
    },
    update: {},
  });

  // Ensure 3 default templates
  for (const t of DEFAULT_REMINDER_TEMPLATES) {
    await prisma.reminderTemplate.upsert({
      where: {
        shopId_stepNumber: {
          shopId,
          stepNumber: t.stepNumber,
        },
      },
      create: {
        shopId,
        stepNumber: t.stepNumber,
        title: t.title,
        bodyText: t.bodyText,
        languageCode: "en",
        isActive: true,
      },
      update: {},
    });
  }
}

/**
 * Evaluates reminder eligibility for all customers of a shop:
 * 1. Cancels active reminder sequences for customers who made a new purchase after the sequence's purchase date.
 * 2. Cancels active reminder sequences for customers who opted out or were soft-deleted.
 * 3. Identifies customers whose latest active purchase is 6 calendar months old, and creates a SCHEDULED ReminderSequence if none exists.
 * 4. Ensures attempt for step 1 is initialized if needed.
 */
export async function syncReminderEligibility(options: SyncReminderOptions): Promise<SyncReminderResult> {
  const { shopId } = options;
  const refDate = options.referenceDate ?? shopToday();

  await ensureShopReminderDefaults(shopId);

  let sequencesCreated = 0;
  let sequencesCancelledNewPurchase = 0;
  let sequencesCancelledOptOut = 0;
  let sequencesCancelledSoftDelete = 0;

  // 1. Process active sequences: check for new purchases, soft deletion, or opt-out
  const activeSequences = await prisma.reminderSequence.findMany({
    where: {
      shopId,
      status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED"] },
    },
    include: {
      customer: {
        include: {
          consent: true,
        },
      },
      purchaseRecord: true,
    },
  });

  for (const seq of activeSequences) {
    // Condition A: Customer soft-deleted or inactive
    if (seq.customer.deletedAt || !seq.customer.isActive) {
      await prisma.reminderSequence.update({
        where: { id: seq.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "CUSTOMER_DELETED",
        },
      });
      // Cancel pending attempts
      await prisma.reminderAttempt.updateMany({
        where: { sequenceId: seq.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      sequencesCancelledSoftDelete++;
      continue;
    }

    // Condition B: Customer opted out
    if (seq.customer.consent && seq.customer.consent.status === "OPTED_OUT") {
      await prisma.reminderSequence.update({
        where: { id: seq.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "CUSTOMER_OPT_OUT",
        },
      });
      await prisma.reminderAttempt.updateMany({
        where: { sequenceId: seq.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      sequencesCancelledOptOut++;
      continue;
    }

    // Condition C: Purchase record soft-deleted
    if (seq.purchaseRecord.deletedAt) {
      await prisma.reminderSequence.update({
        where: { id: seq.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "MANUALLY_CANCELLED",
        },
      });
      await prisma.reminderAttempt.updateMany({
        where: { sequenceId: seq.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      continue;
    }

    // Condition D: New purchase occurred AFTER this sequence's purchase date
    const seqPurchaseDate = seq.purchaseRecord.purchaseDate ?? seq.purchaseRecord.createdAt;
    const newerPurchase = await prisma.customerRecord.findFirst({
      where: {
        customerId: seq.customerId,
        deletedAt: null,
        id: { not: seq.purchaseRecordId },
        purchaseDate: {
          gt: seqPurchaseDate,
        },
      },
    });

    if (newerPurchase) {
      await prisma.reminderSequence.update({
        where: { id: seq.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: "NEW_PURCHASE",
        },
      });
      await prisma.reminderAttempt.updateMany({
        where: { sequenceId: seq.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      sequencesCancelledNewPurchase++;
      continue;
    }
  }

  // 2. Discover customers eligible for a new 6-month sequence
  // Find all active, non-deleted customers in this shop
  const customers = await prisma.customer.findMany({
    where: {
      shopId,
      deletedAt: null,
      isActive: true,
    },
    include: {
      consent: true,
      records: {
        where: { deletedAt: null },
        orderBy: [
          { purchaseDate: "desc" },
          { createdAt: "desc" },
        ],
        take: 1,
      },
      reminderSequences: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  for (const cust of customers) {
    // Skip if customer opted out
    if (cust.consent && cust.consent.status === "OPTED_OUT") {
      continue;
    }

    // Must have at least one purchase record with a purchase date
    const latestPurchase = cust.records[0];
    if (!latestPurchase || !latestPurchase.purchaseDate) {
      continue;
    }

    // Calculate eligibility (6 calendar months after purchase date)
    const eligibilityDate = calculateSixMonthEligibility(latestPurchase.purchaseDate);

    // If eligibilityDate is in the future relative to refDate, not due yet
    // But we still schedule it if it doesn't already have an active sequence
    const existingSeq = cust.reminderSequences[0];
    if (existingSeq && existingSeq.purchaseRecordId === latestPurchase.id) {
      // Sequence already created for this purchase
      continue;
    }

    // Create new ReminderSequence
    const seq = await prisma.reminderSequence.create({
      data: {
        shopId,
        customerId: cust.id,
        purchaseRecordId: latestPurchase.id,
        status: "SCHEDULED",
        currentStep: 1,
        eligibilityDate,
      },
    });

    // Create initial Step 1 attempt
    const step1Template = await prisma.reminderTemplate.findUnique({
      where: {
        shopId_stepNumber: {
          shopId,
          stepNumber: 1,
        },
      },
    });

    await prisma.reminderAttempt.create({
      data: {
        sequenceId: seq.id,
        stepNumber: 1,
        templateId: step1Template?.id,
        status: "PENDING",
        scheduledFor: eligibilityDate,
        recipientPhone: cust.mobNumber || "",
        messageContent: step1Template?.bodyText || DEFAULT_REMINDER_TEMPLATES[0].bodyText,
      },
    });

    sequencesCreated++;
  }

  // Count due reminders as of refDate
  const dueRemindersCount = await prisma.reminderAttempt.count({
    where: {
      sequence: {
        shopId,
        status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      },
      status: "PENDING",
      scheduledFor: { lte: refDate },
    },
  });

  return {
    shopId,
    referenceDate: refDate.toISOString().slice(0, 10),
    sequencesCreated,
    sequencesCancelledNewPurchase,
    sequencesCancelledOptOut,
    sequencesCancelledSoftDelete,
    dueRemindersCount,
  };
}
