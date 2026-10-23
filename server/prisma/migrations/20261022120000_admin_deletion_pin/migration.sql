CREATE TABLE "AdminDeletionPin" (
  "adminId" INTEGER NOT NULL PRIMARY KEY,
  "pinHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminDeletionPin_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AdminDeletionPin_failedAttempts_check" CHECK ("failedAttempts" >= 0)
);
