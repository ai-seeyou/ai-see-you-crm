-- CreateEnum
CREATE TYPE "ExternalRecordType" AS ENUM ('COMPANY', 'CONTACT');

-- CreateEnum
CREATE TYPE "ExternalSystem" AS ENUM ('PRODUCTION', 'CLAY', 'LINKEDIN', 'CONTEXT_DEV');

-- CreateEnum
CREATE TYPE "MatchActor" AS ENUM ('HUMAN', 'AGENT', 'IMPORT');

-- CreateTable
CREATE TABLE "externalRef" (
    "id" TEXT NOT NULL,
    "recordType" "ExternalRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "system" "ExternalSystem" NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "matchMethod" TEXT NOT NULL,
    "matchedBy" "MatchActor" NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "externalRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "externalRef_recordType_recordId_idx" ON "externalRef"("recordType", "recordId");

-- CreateIndex
CREATE UNIQUE INDEX "externalRef_system_recordType_externalId_key" ON "externalRef"("system", "recordType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "externalRef_system_recordType_recordId_key" ON "externalRef"("system", "recordType", "recordId");
