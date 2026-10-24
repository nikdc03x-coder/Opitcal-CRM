import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import { buildWhatsAppClickToChatUrl, renderReminderTemplate } from "./reminderUtils";
import { sendMetaCloudApiTest } from "./metaWhatsAppTestService";

export interface ConfirmManualSendParams {
  attemptId: string;
  adminUsername: string;
  customMessage?: string;
}

/**
 * Confirms that a manual WhatsApp message was sent by staff.
 * Crucial rule: ONLY confirmed successful sending events advance the sequence!
 * Upon confirmation of step 1, schedules step 2 for exactly 3 days later.
 * Upon confirmation of step 2, schedules step 3 for exactly 3 days later.
 * Step 3 marks sequence as COMPLETED.
 */
export async function confirmManualReminderSend(params: ConfirmManualSendParams) {
  const { attemptId, adminUsername } = params;

  const attempt = await prisma.reminderAttempt.findUnique({
    where: { id: attemptId },
    include: {
      sequence: {
        include: {
          customer: { include: { consent: true } },
          shop: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new HttpError("Reminder attempt not found", 404);
  }

  if (attempt.status === "SENT" || attempt.status === "DELIVERED") {
    throw new HttpError("Attempt is already marked as sent.", 400);
  }

  // Update current attempt to SENT
  const sentTime = new Date();
  await prisma.reminderAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "SENT",
      sentAt: sentTime,
      channel: "MANUAL_CLICK_TO_CHAT",
      manualConfirmedBy: adminUsername,
      ...(params.customMessage?.trim() ? { messageContent: params.customMessage.trim() } : {}),
    },
  });

  const sequence = attempt.sequence;
  const currentStep = attempt.stepNumber;

  if (currentStep < 3) {
    const nextStep = currentStep + 1;
    // Exactly 3 days after actual confirmed sending
    const nextScheduledFor = new Date(sentTime.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Fetch next step template
    const template = await prisma.reminderTemplate.findUnique({
      where: {
        shopId_stepNumber: {
          shopId: sequence.shopId,
          stepNumber: nextStep,
        },
      },
    });

    const shopName =
      sequence.shop?.name && !sequence.shop.name.includes("Demo")
        ? sequence.shop.name
        : "Harshu Chasma Ghar";
    const renderedMessage = template
      ? renderReminderTemplate(template.bodyText, {
          customerName: sequence.customer.name,
          shopName,
          stepNumber: nextStep,
        })
      : `Eye checkup reminder follow up from ${shopName}`;

    // Create next step attempt
    await prisma.reminderAttempt.create({
      data: {
        sequenceId: sequence.id,
        stepNumber: nextStep,
        templateId: template?.id,
        status: "PENDING",
        scheduledFor: nextScheduledFor,
        recipientPhone: sequence.customer.mobNumber || "",
        messageContent: renderedMessage,
      },
    });

    // Update sequence
    await prisma.reminderSequence.update({
      where: { id: sequence.id },
      data: {
        currentStep: nextStep,
        status: "IN_PROGRESS",
      },
    });
  } else {
    // Step 3 was sent - sequence completed!
    await prisma.reminderSequence.update({
      where: { id: sequence.id },
      data: {
        status: "COMPLETED",
        completedAt: sentTime,
      },
    });
  }

  return { success: true, attemptId, currentStep, completed: currentStep >= 3 };
}

/**
 * Handles confirmation after Meta Test API accepted a message.
 * Advances to next step (3 days later) or marks complete.
 */
export async function advanceSequenceAfterMetaApiSend(attemptId: string) {
  const attempt = await prisma.reminderAttempt.findUnique({
    where: { id: attemptId },
    include: {
      sequence: {
        include: {
          customer: true,
          shop: true,
        },
      },
    },
  });

  if (
    !attempt ||
    (attempt.status !== "ACCEPTED" && attempt.status !== "SENT" && attempt.status !== "DELIVERED")
  ) {
    return;
  }

  const sequence = attempt.sequence;
  const currentStep = attempt.stepNumber;
  const sentTime = attempt.sentAt || new Date();

  if (currentStep < 3) {
    const nextStep = currentStep + 1;
    const nextScheduledFor = new Date(sentTime.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Check if next step attempt already exists
    const existingNext = await prisma.reminderAttempt.findFirst({
      where: {
        sequenceId: sequence.id,
        stepNumber: nextStep,
      },
    });

    if (!existingNext) {
      const template = await prisma.reminderTemplate.findUnique({
        where: {
          shopId_stepNumber: {
            shopId: sequence.shopId,
            stepNumber: nextStep,
          },
        },
      });

      const shopName =
        sequence.shop?.name && !sequence.shop.name.includes("Demo")
          ? sequence.shop.name
          : "Harshu Chasma Ghar";
      const renderedMessage = template
        ? renderReminderTemplate(template.bodyText, {
            customerName: sequence.customer.name,
            shopName,
            stepNumber: nextStep,
          })
        : `Eye checkup reminder follow up from ${shopName}`;

      await prisma.reminderAttempt.create({
        data: {
          sequenceId: sequence.id,
          stepNumber: nextStep,
          templateId: template?.id,
          status: "PENDING",
          scheduledFor: nextScheduledFor,
          recipientPhone: sequence.customer.mobNumber || "",
          messageContent: renderedMessage,
        },
      });

      await prisma.reminderSequence.update({
        where: { id: sequence.id },
        data: {
          currentStep: nextStep,
          status: "IN_PROGRESS",
        },
      });
    }
  } else {
    await prisma.reminderSequence.update({
      where: { id: sequence.id },
      data: {
        status: "COMPLETED",
        completedAt: sentTime,
      },
    });
  }
}
