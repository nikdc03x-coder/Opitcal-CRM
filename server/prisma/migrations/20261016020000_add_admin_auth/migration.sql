
-- nik - One Admin account for the entire CRM database.
CREATE TABLE "admins" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admins_single_account_check" CHECK ("id" = 1)
);

-- nik - Admin usernames must be unique.
CREATE UNIQUE INDEX "admins_username_key"
ON "admins"("username");

-- nik - Store hashes of login session tokens.
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_tokenHash_key"
ON "AdminSession"("tokenHash");

CREATE INDEX "AdminSession_adminId_idx"
ON "AdminSession"("adminId");

CREATE INDEX "AdminSession_expiresAt_idx"
ON "AdminSession"("expiresAt");

-- nik - Deleting an Admin also removes their sessions.
ALTER TABLE "AdminSession"
ADD CONSTRAINT "AdminSession_adminId_fkey"
FOREIGN KEY ("adminId")
REFERENCES "admins"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
