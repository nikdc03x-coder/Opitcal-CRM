-- Historical prescriptions deliberately have no purchase provenance.
-- deletedAt may already exist on installations with the older Trash feature.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "CustomerRecord" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "deletionGroupId" TEXT;
ALTER TABLE "CustomerRecord" ADD COLUMN "deletionGroupId" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "deletionGroupId" TEXT,
  ADD COLUMN "createdForPurchaseId" TEXT;
CREATE INDEX "CustomerRecord_deletionGroupId_idx" ON "CustomerRecord"("deletionGroupId");
CREATE INDEX "Prescription_deletionGroupId_idx" ON "Prescription"("deletionGroupId");
CREATE UNIQUE INDEX "Prescription_createdForPurchaseId_key" ON "Prescription"("createdForPurchaseId");
