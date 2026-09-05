/**
 * Upstream's PostHog project, blanked.
 *
 * These held Comp AI's write key and collector host
 * (`https://k.trycomp.ai`). The AI See You CRM reports nothing, so there is no
 * destination and no credential. Blank values are deliberate: they are the
 * second half of the guarantee in `disabled.ts`, so that even a build which
 * somehow bypassed `HARD_DISABLED` has nowhere to send to.
 *
 * Do not put an AI See You PostHog project here without a founder decision.
 */
export const POSTHOG_KEY = "";
export const POSTHOG_HOST = "";
export const POSTHOG_UI_HOST = "";
