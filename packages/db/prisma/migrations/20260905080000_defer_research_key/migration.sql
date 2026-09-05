-- Upstream's onboarding gate cannot be passed without a Context.dev key, so a
-- workspace that has not bought one cannot use the CRM at all. This records the
-- moment somebody chose to go on without a key. Settings still asks for one, and
-- the research agent still reports that it has nowhere to look.
ALTER TABLE "appSetting" ADD COLUMN "contextDevDeferredAt" TIMESTAMP(3);
