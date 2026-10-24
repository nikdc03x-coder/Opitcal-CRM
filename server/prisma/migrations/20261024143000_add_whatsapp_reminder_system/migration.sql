-- 20261024143000_add_whatsapp_reminder_system
-- Additive migration for WhatsApp eye-checkup reminder system

CREATE TYPE "WhatsAppMode" AS ENUM ('DISABLED', 'MANUAL_FREE', 'META_TEST');
CREATE TYPE "SequenceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PAUSED');
CREATE TYPE "SequenceCancellationReason" AS ENUM ('NEW_PURCHASE', 'CUSTOMER_OPT_OUT', 'MANUALLY_CANCELLED', 'INVALID_PHONE', 'CUSTOMER_DELETED');
CREATE TYPE "AttemptStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');
CREATE TYPE "SendingChannel" AS ENUM ('MANUAL_CLICK_TO_CHAT', 'META_CLOUD_API_TEST');
CREATE TYPE "ConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNSPECIFIED');

-- Shop Reminder Setting
CREATE TABLE "ShopReminderSetting" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "mode" "WhatsAppMode" NOT NULL DEFAULT 'DISABLED',
    "optOutKeywords" TEXT NOT NULL DEFAULT 'STOP,UNSUBSCRIBE,CANCEL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopReminderSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopReminderSetting_shopId_key" ON "ShopReminderSetting"("shopId");

ALTER TABLE "ShopReminderSetting" ADD CONSTRAINT "ShopReminderSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Customer Communication Consent
CREATE TABLE "CustomerCommunicationConsent" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'UNSPECIFIED',
    "source" TEXT,
    "notes" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "optedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCommunicationConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerCommunicationConsent_customerId_key" ON "CustomerCommunicationConsent"("customerId");

ALTER TABLE "CustomerCommunicationConsent" ADD CONSTRAINT "CustomerCommunicationConsent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder Template
CREATE TABLE "ReminderTemplate" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "metaTemplateName" TEXT,
    "languageCode" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderTemplate_shopId_stepNumber_key" ON "ReminderTemplate"("shopId", "stepNumber");

ALTER TABLE "ReminderTemplate" ADD CONSTRAINT "ReminderTemplate_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder Sequence
CREATE TABLE "ReminderSequence" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purchaseRecordId" TEXT NOT NULL,
    "status" "SequenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "eligibilityDate" DATE NOT NULL,
    "cancellationReason" "SequenceCancellationReason",
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderSequence_purchaseRecordId_key" ON "ReminderSequence"("purchaseRecordId");
CREATE INDEX "ReminderSequence_shopId_status_idx" ON "ReminderSequence"("shopId", "status");
CREATE INDEX "ReminderSequence_customerId_status_idx" ON "ReminderSequence"("customerId", "status");
CREATE INDEX "ReminderSequence_eligibilityDate_idx" ON "ReminderSequence"("eligibilityDate");

ALTER TABLE "ReminderSequence" ADD CONSTRAINT "ReminderSequence_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderSequence" ADD CONSTRAINT "ReminderSequence_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderSequence" ADD CONSTRAINT "ReminderSequence_purchaseRecordId_fkey" FOREIGN KEY ("purchaseRecordId") REFERENCES "CustomerRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder Attempt
CREATE TABLE "ReminderAttempt" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "templateId" TEXT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "SendingChannel",
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "recipientPhone" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "metaMessageId" TEXT,
    "manualConfirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderAttempt_metaMessageId_key" ON "ReminderAttempt"("metaMessageId");
CREATE INDEX "ReminderAttempt_sequenceId_stepNumber_idx" ON "ReminderAttempt"("sequenceId", "stepNumber");
CREATE INDEX "ReminderAttempt_status_scheduledFor_idx" ON "ReminderAttempt"("status", "scheduledFor");

ALTER TABLE "ReminderAttempt" ADD CONSTRAINT "ReminderAttempt_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "ReminderSequence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderAttempt" ADD CONSTRAINT "ReminderAttempt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReminderTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

