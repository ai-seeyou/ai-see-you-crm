-- Constraints the model always assumed and never stated, plus the historical rows
-- the stage rename left behind. Each one was found by trying to break the model
-- rather than by reading it.

-- A business cannot be its own parent, brand, manager or owner. The graph accepted
-- A MANAGED_BY A, which reads as a cycle to anything that walks it.
DELETE FROM "entityRelationship" WHERE "fromCompanyId" = "toCompanyId";

ALTER TABLE "entityRelationship"
  ADD CONSTRAINT "entity_relationship_not_self"
  CHECK ("fromCompanyId" <> "toCompanyId");

-- A period that ends before it starts is not a period. Both temporal tables took
-- one without complaint.
UPDATE "entityRelationship"
   SET "validFrom" = NULL
 WHERE "validTo" IS NOT NULL AND "validFrom" IS NOT NULL AND "validTo" < "validFrom";

ALTER TABLE "entityRelationship"
  ADD CONSTRAINT "entity_relationship_period"
  CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" >= "validFrom");

UPDATE "contactAssignment"
   SET "validFrom" = NULL
 WHERE "validTo" IS NOT NULL AND "validFrom" IS NOT NULL AND "validTo" < "validFrom";

ALTER TABLE "contactAssignment"
  ADD CONSTRAINT "contact_assignment_period"
  CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" >= "validFrom");

-- isPrimary means "this is the employer". The partial unique index allows one
-- primary row per contact, so a RESPONSIBLE_FOR row marked primary took the slot
-- and every later write to Contact.companyId then failed on the trigger's insert.
UPDATE "contactAssignment"
   SET "isPrimary" = false
 WHERE "isPrimary" = true AND "scope" <> 'EMPLOYER';

ALTER TABLE "contactAssignment"
  ADD CONSTRAINT "contact_assignment_primary_is_employer"
  CHECK (NOT "isPrimary" OR "scope" = 'EMPLOYER');

-- A STAGE_CHANGE activity records the stage names as they were, so the timeline
-- reads "Retired stage" for everything written before the travel pipeline. Rewrite
-- the names with the same mapping the deal rows took.
UPDATE "activity"
   SET "meta" = jsonb_set(
     jsonb_set(
       "meta",
       '{from}',
       to_jsonb(
         CASE "meta" ->> 'from'
           WHEN 'DEMO_BOOKED' THEN 'ENGAGED'
           WHEN 'QUALIFIED_TO_BUY' THEN 'EVALUATING'
           WHEN 'DECISION_MAKER_BOUGHT_IN' THEN 'EVALUATING'
           WHEN 'CONTRACT_SENT' THEN 'PROPOSAL_SENT'
           WHEN 'CLOSED_WON' THEN 'LIVE'
           WHEN 'UNQUALIFIED_TO_BUY' THEN 'DORMANT'
           ELSE "meta" ->> 'from'
         END
       )
     ),
     '{to}',
     to_jsonb(
       CASE "meta" ->> 'to'
         WHEN 'DEMO_BOOKED' THEN 'ENGAGED'
         WHEN 'QUALIFIED_TO_BUY' THEN 'EVALUATING'
         WHEN 'DECISION_MAKER_BOUGHT_IN' THEN 'EVALUATING'
         WHEN 'CONTRACT_SENT' THEN 'PROPOSAL_SENT'
         WHEN 'CLOSED_WON' THEN 'LIVE'
         WHEN 'UNQUALIFIED_TO_BUY' THEN 'DORMANT'
         ELSE "meta" ->> 'to'
       END
     )
   )
 WHERE "type" = 'STAGE_CHANGE'
   AND "meta" IS NOT NULL
   AND jsonb_typeof("meta") = 'object'
   AND ("meta" ? 'from' OR "meta" ? 'to');
