-- nik - Nullable observations preserve existing customers; no backfill or age inference is needed.
ALTER TABLE "Customer"
ADD COLUMN "ageAtRecording" INTEGER,
ADD COLUMN "ageRecordedAt" TIMESTAMP(3);
