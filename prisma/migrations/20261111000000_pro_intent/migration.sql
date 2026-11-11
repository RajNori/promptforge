-- CreateIndex
CREATE INDEX "UsageEvent_createdAt_idx" ON "UsageEvent"("createdAt");

-- CreateTable
CREATE TABLE "ProIntent" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProIntent_subject_createdAt_idx" ON "ProIntent"("subject", "createdAt");

-- CreateIndex
CREATE INDEX "ProIntent_createdAt_idx" ON "ProIntent"("createdAt");

-- AddForeignKey
ALTER TABLE "ProIntent" ADD CONSTRAINT "ProIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
