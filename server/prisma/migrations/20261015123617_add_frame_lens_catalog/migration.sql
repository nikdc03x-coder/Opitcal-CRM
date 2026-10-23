-- AlterTable
ALTER TABLE "CustomerRecord" ADD COLUMN     "frameCatalogId" TEXT,
ADD COLUMN     "lensCatalogId" TEXT;

-- CreateTable
CREATE TABLE "FrameCatalog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "brand" VARCHAR(150) NOT NULL,
    "model" VARCHAR(150) NOT NULL,
    "frameCode" VARCHAR(100),
    "frameStyle" VARCHAR(100),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FrameCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensCatalog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "company" VARCHAR(150) NOT NULL,
    "lensName" VARCHAR(150) NOT NULL,
    "visionType" VARCHAR(100) NOT NULL,
    "coating" VARCHAR(200),
    "lensCode" VARCHAR(100),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameCatalog_shopId_isActive_brand_idx" ON "FrameCatalog"("shopId", "isActive", "brand");

-- CreateIndex
CREATE INDEX "FrameCatalog_shopId_model_idx" ON "FrameCatalog"("shopId", "model");

-- CreateIndex
CREATE INDEX "LensCatalog_shopId_isActive_company_idx" ON "LensCatalog"("shopId", "isActive", "company");

-- CreateIndex
CREATE INDEX "LensCatalog_shopId_lensName_idx" ON "LensCatalog"("shopId", "lensName");

-- CreateIndex
CREATE INDEX "LensCatalog_shopId_visionType_idx" ON "LensCatalog"("shopId", "visionType");

-- CreateIndex
CREATE INDEX "CustomerRecord_frameCatalogId_idx" ON "CustomerRecord"("frameCatalogId");

-- CreateIndex
CREATE INDEX "CustomerRecord_lensCatalogId_idx" ON "CustomerRecord"("lensCatalogId");

-- AddForeignKey
ALTER TABLE "FrameCatalog" ADD CONSTRAINT "FrameCatalog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensCatalog" ADD CONSTRAINT "LensCatalog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRecord" ADD CONSTRAINT "CustomerRecord_frameCatalogId_fkey" FOREIGN KEY ("frameCatalogId") REFERENCES "FrameCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRecord" ADD CONSTRAINT "CustomerRecord_lensCatalogId_fkey" FOREIGN KEY ("lensCatalogId") REFERENCES "LensCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
