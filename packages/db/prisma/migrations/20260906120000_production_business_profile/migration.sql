CREATE TYPE "ProductionOwnershipStatus" AS ENUM ('chained', 'independent_confirmed', 'unresolved');
CREATE TYPE "ProductionLocalityType" AS ENUM ('precinct', 'district', 'suburb', 'transit_zone', 'coastal_zone', 'airport_zone', 'event_zone', 'landmark');

CREATE TABLE "productionBusinessProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productionPropertyId" TEXT NOT NULL,
    "propertySlug" TEXT,
    "ownershipStatus" "ProductionOwnershipStatus" NOT NULL,
    "destinationProductionId" TEXT NOT NULL,
    "destinationName" TEXT NOT NULL,
    "destinationSlug" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "localityProductionId" TEXT,
    "localityName" TEXT,
    "localitySlug" TEXT,
    "localityType" "ProductionLocalityType",
    "brandText" TEXT,
    "commercialKnowledge" JSONB NOT NULL,
    "recommendationSummary" JSONB,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "productionBusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "externalRelationshipRef" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "system" "ExternalSystem" NOT NULL,
    "externalId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "staleAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "externalRelationshipRef_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "productionImportRun" ADD COLUMN "relationshipCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "productionImportRun" ADD COLUMN "staleRelationshipCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "productionBusinessProfile_companyId_key" ON "productionBusinessProfile"("companyId");
CREATE UNIQUE INDEX "productionBusinessProfile_productionPropertyId_key" ON "productionBusinessProfile"("productionPropertyId");
CREATE INDEX "productionBusinessProfile_sourceUpdatedAt_idx" ON "productionBusinessProfile"("sourceUpdatedAt");
CREATE INDEX "productionBusinessProfile_destinationProductionId_idx" ON "productionBusinessProfile"("destinationProductionId");
CREATE INDEX "productionBusinessProfile_localityProductionId_idx" ON "productionBusinessProfile"("localityProductionId");
CREATE UNIQUE INDEX "externalRelationshipRef_relationshipId_key" ON "externalRelationshipRef"("relationshipId");
CREATE UNIQUE INDEX "externalRelationshipRef_system_externalId_key" ON "externalRelationshipRef"("system", "externalId");
CREATE INDEX "externalRelationshipRef_system_staleAt_idx" ON "externalRelationshipRef"("system", "staleAt");

ALTER TABLE "productionBusinessProfile" ADD CONSTRAINT "productionBusinessProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "externalRelationshipRef" ADD CONSTRAINT "externalRelationshipRef_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "entityRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
