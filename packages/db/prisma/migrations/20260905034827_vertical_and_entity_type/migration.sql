-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('HOTEL', 'HOTEL_GROUP', 'HOTEL_BRAND', 'MANAGEMENT_COMPANY', 'OWNERSHIP_GROUP', 'DESTINATION_ORGANISATION', 'CRUISE_LINE', 'CRUISE_SHIP', 'TOUR_OPERATOR', 'OTHER');

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "entityType" "EntityType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "verticalId" TEXT;

-- CreateTable
CREATE TABLE "vertical" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "vertical_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vertical_key_key" ON "vertical"("key");

-- CreateIndex
CREATE INDEX "vertical_position_idx" ON "vertical"("position");

-- CreateIndex
CREATE INDEX "company_verticalId_idx" ON "company"("verticalId");

-- CreateIndex
CREATE INDEX "company_entityType_idx" ON "company"("entityType");

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_verticalId_fkey" FOREIGN KEY ("verticalId") REFERENCES "vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the four verticals. A vertical is a row so that adding one needs no migration.
INSERT INTO "vertical" ("id", "key", "label", "position") VALUES
    ('vertical_hotel', 'hotel', 'Hotel', 0),
    ('vertical_cruise', 'cruise', 'Cruise', 1),
    ('vertical_tour', 'tour', 'Tour', 2),
    ('vertical_destination', 'destination', 'Destination', 3)
ON CONFLICT ("key") DO NOTHING;
