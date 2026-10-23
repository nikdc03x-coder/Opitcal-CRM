BEGIN;
CREATE TYPE "AccountRole" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "admins" DROP CONSTRAINT "admins_single_account_check";
CREATE SEQUENCE "admins_id_seq" OWNED BY "admins"."id";
SELECT setval('"admins_id_seq"', COALESCE((SELECT MAX("id") FROM "admins"), 0) + 1, false);
ALTER TABLE "admins" ALTER COLUMN "id" SET DEFAULT nextval('"admins_id_seq"');
ALTER TABLE "admins"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "role" "AccountRole" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");
CREATE TABLE "PasswordResetToken" (
  "id" TEXT PRIMARY KEY,
  "adminId" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PasswordResetToken_adminId_idx" ON "PasswordResetToken"("adminId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE TABLE "AccountRateLimit" (
  "key" TEXT PRIMARY KEY,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AccountRateLimit_expiresAt_idx" ON "AccountRateLimit"("expiresAt");
COMMIT;
