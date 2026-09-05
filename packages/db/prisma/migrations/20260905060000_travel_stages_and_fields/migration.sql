-- The travel pipeline replaces the inherited B2B SaaS one, and the company fields
-- follow it. Every stage a deal could hold is mapped, so no row is stranded on a
-- value the enum no longer has, and the saved views that filter on those values are
-- rewritten in the same migration. A stage filter left holding DEMO_BOOKED would
-- match nothing, for ever, without an error.

-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'OUTREACH';
ALTER TYPE "ActivityType" ADD VALUE 'REPLY';

-- AlterEnum
BEGIN;
CREATE TYPE "DealStage_new" AS ENUM ('IDENTIFIED', 'CONTACTED', 'ENGAGED', 'EVALUATING', 'PROPOSAL_SENT', 'IN_CONTRACT', 'LIVE', 'CLOSED_LOST', 'DORMANT');
ALTER TABLE "public"."deal" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "deal" ALTER COLUMN "stage" TYPE "DealStage_new" USING (
  CASE "stage"::text
    WHEN 'DEMO_BOOKED' THEN 'ENGAGED'
    WHEN 'QUALIFIED_TO_BUY' THEN 'EVALUATING'
    WHEN 'DECISION_MAKER_BOUGHT_IN' THEN 'EVALUATING'
    WHEN 'CONTRACT_SENT' THEN 'PROPOSAL_SENT'
    WHEN 'CLOSED_WON' THEN 'LIVE'
    WHEN 'CLOSED_LOST' THEN 'CLOSED_LOST'
    WHEN 'UNQUALIFIED_TO_BUY' THEN 'DORMANT'
    ELSE 'IDENTIFIED'
  END::"DealStage_new"
);
ALTER TYPE "DealStage" RENAME TO "DealStage_old";
ALTER TYPE "DealStage_new" RENAME TO "DealStage";
DROP TYPE "public"."DealStage_old";
ALTER TABLE "deal" ALTER COLUMN "stage" SET DEFAULT 'IDENTIFIED';
COMMIT;

-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "outreachMessageId" TEXT;

-- CreateTable
CREATE TABLE "opportunityEntity" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunityEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunityEntity_companyId_idx" ON "opportunityEntity"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "opportunityEntity_dealId_companyId_key" ON "opportunityEntity"("dealId", "companyId");

-- AddForeignKey
ALTER TABLE "opportunityEntity" ADD CONSTRAINT "opportunityEntity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunityEntity" ADD CONSTRAINT "opportunityEntity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rewrite the stage values inside every saved view that filters on them.
UPDATE "savedView" AS v
SET "filters" = jsonb_set(
  v."filters",
  '{filters,stage}',
  COALESCE((
    SELECT jsonb_agg(DISTINCT m.mapped)
    FROM jsonb_array_elements_text(v."filters" #> '{filters,stage}') AS old(value)
    CROSS JOIN LATERAL (
      SELECT CASE old.value
        WHEN 'DEMO_BOOKED' THEN 'ENGAGED'
        WHEN 'QUALIFIED_TO_BUY' THEN 'EVALUATING'
        WHEN 'DECISION_MAKER_BOUGHT_IN' THEN 'EVALUATING'
        WHEN 'CONTRACT_SENT' THEN 'PROPOSAL_SENT'
        WHEN 'CLOSED_WON' THEN 'LIVE'
        WHEN 'CLOSED_LOST' THEN 'CLOSED_LOST'
        WHEN 'UNQUALIFIED_TO_BUY' THEN 'DORMANT'
        ELSE NULL
      END AS mapped
    ) AS m
    WHERE m.mapped IS NOT NULL
  ), '[]'::jsonb)
)
WHERE v."filters" #> '{filters,stage}' IS NOT NULL
  AND jsonb_typeof(v."filters" #> '{filters,stage}') = 'array';

-- Retire the inherited B2B SaaS company fields. They are archived, not deleted,
-- because a value somebody typed is theirs and an archived definition still reads.
UPDATE "fieldDefinition"
SET "archivedAt" = NOW(), "showOnTable" = false, "showOnFilter" = false, "updatedAt" = NOW()
WHERE "entity" = 'COMPANY'
  AND "key" IN ('account_type', 'segment', 'territory', 'icp_fit_score', 'bdr_owner')
  AND "archivedAt" IS NULL;

-- Rename the lifecycle stages a SaaS funnel used to the ones a travel business has.
UPDATE "fieldOption" o SET "label" = t.replacement
FROM "fieldDefinition" d,
  (VALUES ('Lead', 'Target'), ('MQL', 'Contacted'), ('SQL', 'Engaged')) AS t(previous, replacement)
WHERE o."fieldId" = d."id"
  AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage'
  AND o."label" = t.previous;

-- The travel company fields.
INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_lifecycle_stage', 'COMPANY', 'lifecycle_stage', 'Lifecycle stage', 'SELECT', true, false, true, true, true, 0, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_target', d."id", 'Target', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Target'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Target';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_contacted', d."id", 'Contacted', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Contacted'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Contacted';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_engaged', d."id", 'Engaged', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Engaged'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Engaged';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_opportunity', d."id", 'Opportunity', 3
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Opportunity'
  );

UPDATE "fieldOption" o SET "position" = 3, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Opportunity';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_customer', d."id", 'Customer', 4
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Customer'
  );

UPDATE "fieldOption" o SET "position" = 4, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Customer';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_dormant', d."id", 'Dormant', 5
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Dormant'
  );

UPDATE "fieldOption" o SET "position" = 5, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Dormant';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lifecycle_stage_not_a_fit', d."id", 'Not a fit', 6
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lifecycle_stage'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Not a fit'
  );

UPDATE "fieldOption" o SET "position" = 6, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lifecycle_stage' AND o."label" = 'Not a fit';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_region', 'COMPANY', 'region', 'Region', 'SELECT', true, false, true, true, true, 1, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_australia_and_new_zealand', d."id", 'Australia and New Zealand', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Australia and New Zealand'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Australia and New Zealand';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_pacific', d."id", 'Pacific', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Pacific'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Pacific';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_south_east_asia', d."id", 'South East Asia', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'South East Asia'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'South East Asia';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_north_asia', d."id", 'North Asia', 3
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'North Asia'
  );

UPDATE "fieldOption" o SET "position" = 3, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'North Asia';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_south_asia', d."id", 'South Asia', 4
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'South Asia'
  );

UPDATE "fieldOption" o SET "position" = 4, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'South Asia';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_middle_east', d."id", 'Middle East', 5
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Middle East'
  );

UPDATE "fieldOption" o SET "position" = 5, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Middle East';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_europe', d."id", 'Europe', 6
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Europe'
  );

UPDATE "fieldOption" o SET "position" = 6, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Europe';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_americas', d."id", 'Americas', 7
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Americas'
  );

UPDATE "fieldOption" o SET "position" = 7, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Americas';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_region_africa', d."id", 'Africa', 8
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'region'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Africa'
  );

UPDATE "fieldOption" o SET "position" = 8, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'region' AND o."label" = 'Africa';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_chain_scale', 'COMPANY', 'chain_scale', 'Chain scale', 'SELECT', true, false, true, false, true, 2, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_luxury', d."id", 'Luxury', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Luxury'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Luxury';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_upper_upscale', d."id", 'Upper upscale', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Upper upscale'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Upper upscale';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_upscale', d."id", 'Upscale', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Upscale'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Upscale';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_upper_midscale', d."id", 'Upper midscale', 3
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Upper midscale'
  );

UPDATE "fieldOption" o SET "position" = 3, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Upper midscale';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_midscale', d."id", 'Midscale', 4
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Midscale'
  );

UPDATE "fieldOption" o SET "position" = 4, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Midscale';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_economy', d."id", 'Economy', 5
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Economy'
  );

UPDATE "fieldOption" o SET "position" = 5, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Economy';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_chain_scale_independent', d."id", 'Independent', 6
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'chain_scale'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Independent'
  );

UPDATE "fieldOption" o SET "position" = 6, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'chain_scale' AND o."label" = 'Independent';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_distribution_model', 'COMPANY', 'distribution_model', 'Distribution model', 'SELECT', true, false, true, false, false, 3, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_distribution_model_direct_led', d."id", 'Direct led', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'distribution_model'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Direct led'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'distribution_model' AND o."label" = 'Direct led';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_distribution_model_ota_led', d."id", 'OTA led', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'distribution_model'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'OTA led'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'distribution_model' AND o."label" = 'OTA led';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_distribution_model_wholesale_led', d."id", 'Wholesale led', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'distribution_model'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Wholesale led'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'distribution_model' AND o."label" = 'Wholesale led';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_distribution_model_mixed', d."id", 'Mixed', 3
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'distribution_model'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Mixed'
  );

UPDATE "fieldOption" o SET "position" = 3, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'distribution_model' AND o."label" = 'Mixed';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_priority', 'COMPANY', 'priority', 'Priority', 'SELECT', false, false, true, true, true, 4, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_priority_tier_1', d."id", 'Tier 1', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'priority'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Tier 1'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'priority' AND o."label" = 'Tier 1';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_priority_tier_2', d."id", 'Tier 2', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'priority'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Tier 2'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'priority' AND o."label" = 'Tier 2';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_priority_tier_3', d."id", 'Tier 3', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'priority'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Tier 3'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'priority' AND o."label" = 'Tier 3';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_lead_source', 'COMPANY', 'lead_source', 'Lead source', 'SELECT', true, false, true, false, true, 5, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lead_source_inbound', d."id", 'Inbound', 0
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lead_source'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Inbound'
  );

UPDATE "fieldOption" o SET "position" = 0, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lead_source' AND o."label" = 'Inbound';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lead_source_outbound', d."id", 'Outbound', 1
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lead_source'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Outbound'
  );

UPDATE "fieldOption" o SET "position" = 1, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lead_source' AND o."label" = 'Outbound';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lead_source_referral', d."id", 'Referral', 2
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lead_source'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Referral'
  );

UPDATE "fieldOption" o SET "position" = 2, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lead_source' AND o."label" = 'Referral';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lead_source_event', d."id", 'Event', 3
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lead_source'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Event'
  );

UPDATE "fieldOption" o SET "position" = 3, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lead_source' AND o."label" = 'Event';

INSERT INTO "fieldOption" ("id", "fieldId", "label", "position")
SELECT 'opt_company_lead_source_partner', d."id", 'Partner', 4
FROM "fieldDefinition" d
WHERE d."entity" = 'COMPANY' AND d."key" = 'lead_source'
  AND NOT EXISTS (
    SELECT 1 FROM "fieldOption" o
    WHERE o."fieldId" = d."id" AND o."label" = 'Partner'
  );

UPDATE "fieldOption" o SET "position" = 4, "archivedAt" = NULL
FROM "fieldDefinition" d
WHERE o."fieldId" = d."id" AND d."entity" = 'COMPANY'
  AND d."key" = 'lead_source' AND o."label" = 'Partner';

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "required", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
VALUES ('fld_company_relationship_owner', 'COMPANY', 'relationship_owner', 'Relationship owner', 'USER', false, false, true, false, false, 6, NOW(), NOW())
ON CONFLICT ("entity", "key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "type" = EXCLUDED."type",
  "position" = EXCLUDED."position",
  "showOnTable" = EXCLUDED."showOnTable",
  "showOnFilter" = EXCLUDED."showOnFilter",
  "archivedAt" = NULL;
