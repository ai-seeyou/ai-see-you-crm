CREATE TYPE "ProductionImportStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "externalRef" ADD COLUMN "staleAt" TIMESTAMP(3);
ALTER TABLE "externalRef" ADD COLUMN "reviewReason" TEXT;
CREATE INDEX "externalRef_system_staleAt_idx" ON "externalRef"("system", "staleAt");

CREATE TABLE "productionSnapshot" (
    "productionId" TEXT NOT NULL,
    "entityKind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT,
    "destinationId" TEXT,
    "destinationSlug" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "staleAfter" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "productionSnapshot_pkey" PRIMARY KEY ("productionId")
);

CREATE TABLE "productionImportState" (
    "id" TEXT NOT NULL,
    "cursor" TEXT,
    "snapshot" TEXT,
    "destination" TEXT,
    "updatedSince" TIMESTAMP(3),
    "runId" TEXT,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "sourceWatermark" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "productionImportState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "productionImportRun" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "leaseOwner" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,
    "status" "ProductionImportStatus" NOT NULL DEFAULT 'RUNNING',
    "destination" TEXT,
    "dryRun" BOOLEAN NOT NULL,
    "fullReconciliation" BOOLEAN NOT NULL DEFAULT false,
    "sourceWatermark" TIMESTAMP(3),
    "qualifyingCount" INTEGER,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "chainIdCount" INTEGER NOT NULL DEFAULT 0,
    "missingChainCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "staleRefCount" INTEGER NOT NULL DEFAULT 0,
    "readRequestCount" INTEGER NOT NULL DEFAULT 0,
    "boundaryEvidence" JSONB,
    "reviewItems" JSONB,
    "destinations" INTEGER,
    "countries" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "productionImportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "productionSnapshot_staleAfter_idx" ON "productionSnapshot"("staleAfter");
CREATE INDEX "productionImportRun_startedAt_idx" ON "productionImportRun"("startedAt");
CREATE UNIQUE INDEX "production_import_run_active_key" ON "productionImportRun"("scope") WHERE "status" = 'RUNNING';
CREATE UNIQUE INDEX "agent_task_production_refresh_active_key" ON "agentTask"("kind", "subject") WHERE "finishedAt" IS NULL AND "kind" = 'production-refresh';
