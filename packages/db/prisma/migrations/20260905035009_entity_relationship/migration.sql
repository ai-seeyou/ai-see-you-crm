-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('BELONGS_TO', 'BRAND_OF', 'MANAGED_BY', 'OWNED_BY', 'OPERATED_BY', 'LOCATED_IN');

-- CreateTable
CREATE TABLE "entityRelationship" (
    "id" TEXT NOT NULL,
    "fromCompanyId" TEXT NOT NULL,
    "toCompanyId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "evidence" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entityRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entityRelationship_toCompanyId_type_idx" ON "entityRelationship"("toCompanyId", "type");

-- CreateIndex
CREATE INDEX "entityRelationship_fromCompanyId_type_idx" ON "entityRelationship"("fromCompanyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relationship_current_key" ON "entityRelationship"("fromCompanyId", "toCompanyId", "type") WHERE ("validTo" IS NULL);

-- AddForeignKey
ALTER TABLE "entityRelationship" ADD CONSTRAINT "entityRelationship_fromCompanyId_fkey" FOREIGN KEY ("fromCompanyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entityRelationship" ADD CONSTRAINT "entityRelationship_toCompanyId_fkey" FOREIGN KEY ("toCompanyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
