-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('EMPLOYER', 'RESPONSIBLE_FOR');

-- CreateEnum
CREATE TYPE "ContactRoleType" AS ENUM ('GENERAL_MANAGER', 'REVENUE', 'DISTRIBUTION', 'COMMERCIAL', 'MARKETING', 'DIGITAL', 'OWNER', 'EXECUTIVE', 'PROCUREMENT', 'OTHER');

-- CreateTable
CREATE TABLE "contactAssignment" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "roleType" "ContactRoleType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT,
    "scope" "AssignmentScope" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contactAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contactAssignment_companyId_roleType_idx" ON "contactAssignment"("companyId", "roleType");

-- CreateIndex
CREATE INDEX "contactAssignment_contactId_isPrimary_idx" ON "contactAssignment"("contactId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "contact_assignment_current_key" ON "contactAssignment"("contactId", "companyId", "scope") WHERE ("validTo" IS NULL);

-- CreateIndex
CREATE UNIQUE INDEX "contact_assignment_primary_key" ON "contactAssignment"("contactId") WHERE ("isPrimary" = true AND "validTo" IS NULL);

-- AddForeignKey
ALTER TABLE "contactAssignment" ADD CONSTRAINT "contactAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactAssignment" ADD CONSTRAINT "contactAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration
-- One EMPLOYER assignment per contact that already has a company, so the new
-- table starts as a complete description of what Contact.companyId says.
INSERT INTO "contactAssignment" (
    "id", "contactId", "companyId", "roleType", "scope",
    "isPrimary", "validFrom", "source", "createdAt", "updatedAt"
)
SELECT
    'ca_' || replace(gen_random_uuid()::text, '-', ''),
    c."id",
    c."companyId",
    'OTHER',
    'EMPLOYER',
    true,
    c."createdAt",
    c."source",
    (NOW() AT TIME ZONE 'UTC'),
    (NOW() AT TIME ZONE 'UTC')
FROM "contact" c
WHERE c."companyId" IS NOT NULL;

-- The rule that keeps Contact.companyId and the single primary EMPLOYER
-- assignment in agreement lives in the database, not in a service. Do not move
-- it into the API: Contact.companyId is written by tRPC, by the bulk editor, by
-- the mailbox match, by the tracking filing, by agent tools and by the seed, and
-- a service can only cover the callers that remember to call it. The reverse
-- direction, an assignment change that must move Contact.companyId, is
-- ContactAssignmentService in apps/api, which is the only writer of this table.
CREATE OR REPLACE FUNCTION "crm_sync_employer_assignment"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW."companyId" IS NOT DISTINCT FROM OLD."companyId" THEN
        RETURN NEW;
    END IF;

    UPDATE "contactAssignment"
       SET "validTo" = (NOW() AT TIME ZONE 'UTC'),
           "isPrimary" = false,
           "updatedAt" = (NOW() AT TIME ZONE 'UTC')
     WHERE "contactId" = NEW."id"
       AND "scope" = 'EMPLOYER'
       AND "validTo" IS NULL
       AND "companyId" IS DISTINCT FROM NEW."companyId";

    IF NEW."companyId" IS NOT NULL THEN
        INSERT INTO "contactAssignment" (
            "id", "contactId", "companyId", "roleType", "scope",
            "isPrimary", "validFrom", "source", "createdAt", "updatedAt"
        ) VALUES (
            'ca_' || replace(gen_random_uuid()::text, '-', ''),
            NEW."id",
            NEW."companyId",
            'OTHER',
            'EMPLOYER',
            true,
            (NOW() AT TIME ZONE 'UTC'),
            NEW."source",
            (NOW() AT TIME ZONE 'UTC'),
            (NOW() AT TIME ZONE 'UTC')
        )
        ON CONFLICT ("contactId", "companyId", "scope") WHERE "validTo" IS NULL
        DO UPDATE SET "isPrimary" = true, "updatedAt" = (NOW() AT TIME ZONE 'UTC');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "contact_employer_assignment"
AFTER INSERT OR UPDATE OF "companyId" ON "contact"
FOR EACH ROW EXECUTE FUNCTION "crm_sync_employer_assignment"();
