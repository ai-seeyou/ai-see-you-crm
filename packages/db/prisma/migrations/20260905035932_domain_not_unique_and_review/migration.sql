-- CreateEnum
CREATE TYPE "DomainReviewStatus" AS ENUM ('PROPOSED', 'APPLIED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "DomainReviewReason" AS ENUM ('UNRECOGNISED', 'AMBIGUOUS');

-- DropIndex
DROP INDEX "company_domain_active_key";

-- CreateTable
CREATE TABLE "domainReview" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "email" TEXT,
    "reason" "DomainReviewReason" NOT NULL,
    "status" "DomainReviewStatus" NOT NULL DEFAULT 'PROPOSED',
    "companyId" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'EMAIL',
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domainReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domainReview_status_lastSeenAt_idx" ON "domainReview"("status", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "domain_review_open_key" ON "domainReview"("domain") WHERE ("status" = 'PROPOSED');

-- CreateIndex
CREATE INDEX "company_domain_idx" ON "company"("domain");

-- AddForeignKey
ALTER TABLE "domainReview" ADD CONSTRAINT "domainReview_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domainReview" ADD CONSTRAINT "domainReview_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
