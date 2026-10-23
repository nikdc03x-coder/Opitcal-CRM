-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('SPLIT', 'MRP_ONLY');

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobNumber" TEXT,
    "gender" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyMongoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reDistSph" DECIMAL(5,2),
    "reDistCyl" DECIMAL(5,2),
    "reDistAxis" INTEGER,
    "reNearSph" DECIMAL(5,2),
    "reNearCyl" DECIMAL(5,2),
    "reNearAxis" INTEGER,
    "leDistSph" DECIMAL(5,2),
    "leDistCyl" DECIMAL(5,2),
    "leDistAxis" INTEGER,
    "leNearSph" DECIMAL(5,2),
    "leNearCyl" DECIMAL(5,2),
    "leNearAxis" INTEGER,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRecord" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "prescriptionId" TEXT,
    "specsType" TEXT,
    "lensType" TEXT,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'MRP_ONLY',
    "frameRate" DECIMAL(12,2),
    "lensRate" DECIMAL(12,2),
    "mrp" DECIMAL(12,2) NOT NULL,
    "legacyMongoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_code_key" ON "Shop"("code");

-- CreateIndex
CREATE INDEX "Customer_shopId_mobNumber_idx" ON "Customer"("shopId", "mobNumber");

-- CreateIndex
CREATE INDEX "Customer_shopId_name_idx" ON "Customer"("shopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopId_legacyMongoId_key" ON "Customer"("shopId", "legacyMongoId");

-- CreateIndex
CREATE INDEX "Prescription_customerId_createdAt_idx" ON "Prescription"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerRecord_customerId_createdAt_idx" ON "CustomerRecord"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRecord_customerId_legacyMongoId_key" ON "CustomerRecord"("customerId", "legacyMongoId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRecord" ADD CONSTRAINT "CustomerRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRecord" ADD CONSTRAINT "CustomerRecord_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
