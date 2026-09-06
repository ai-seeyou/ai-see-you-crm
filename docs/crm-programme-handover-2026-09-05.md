# CRM programme handover, 5 September 2026

This document is the authoritative continuation record for the next CRM coordinator.
Read it with `docs/ai-see-you-crm-foundation-audit.md` before changing the programme.

## Later Phase 5 evidence

Read [Production hotel import acceptance](./production-hotel-import-acceptance-2026-09-06.md) for the later import state and security-cleanup requirements.
Its dated evidence supersedes the historical repository and phase status below.
The founder permits only the exact reviewed Production PR 65 migration and the separately approved internal capability rotation.
These operator actions do not permit CRM to write Production or hold Production database credentials.

## Programme boundary

Production says what a travel business is. CRM says what our commercial relationship with it is.
The CRM never writes AI See You Production. No exception or feature flag exists.
The repository keeps its CRM-only Production MCP deny.

The CRM uses its dedicated Supabase project as managed Postgres only.
Keep Prisma and Better Auth. Do not use Supabase Auth, Realtime, or Edge Functions.
The Supabase Data API stays disabled.

## Current repository state

The canonical branch is `release`.
The verified remote release HEAD is `d094e0add943b8bf1d9c8adc43274190c9dd2f63`.
That commit merged PR #10 on 5 September 2026.

The current local branch is `phase-4/agent-sees-the-travel-model`.
Its HEAD is `c3f6794b860b824fa46c80b7207f135ae68c602d`.
The branch matches its remote before this handover commit.

Remote programme branches remain available for Phases 0 through 4.
No branch is protected in GitHub.

This handover commit also contains three pending documentation corrections.
They update phase status, founder access, search exclusion, and Phase 3 visual finishing.

## Phase state

### Phase 0: complete and merged

PR #1 merged as `f6888b58da979f02590ab135c9e4d05678efeadd`.
Telemetry is hard disabled. Marketing and public release automation are removed.
The README, security policy, agent rules, and foundation audit belong to AI See You.
The Comp AI licence notice remains because the MIT licence requires it.
The CRM workspace denies the Production Supabase MCP server.

### Phase 1: complete and merged

PRs #2, #3, #4, #6, #7, and #8 contain Phase 1 work.
The app, API, and agent deploy through three Vercel projects.
The CRM database uses Supavisor with verified TLS.
The API build applies Prisma migrations during production deployment.
Sign-in requests identity scopes only. Mailbox consent is separate.
Context.dev no longer blocks onboarding.

The deployed Google OAuth route starts successfully with `email`, `profile`, and `openid` scopes.
Its callback is `https://api.crm.ai-seeyou.com/api/auth/callback/google`.
Production environment variable names include both Google credentials and `ALLOWED_SIGN_IN`.
The actual `ALLOWED_SIGN_IN` value was not safely readable during handover verification.
It must become exactly `dave@ai-seeyou.com` before real data loads.

### Phase 2: complete and merged

PR #5 merged as `a90f759f9a8ac3f9cf33d63dc69a5119fa0ebc0e`.
The travel model supports verticals, entity types, relationships, assignments, and external references.
It also supports travel opportunity stages and opportunity coverage across businesses.
Domain uniqueness no longer collapses multiple properties onto one corporate domain.
Domain discovery creates a review instead of an automatic business.
Cruise and Tour Operators remain supported by the architecture.
They do not need real data now.

### Phase 3: functionally complete and merged

PR #9 merged as `d6280c2901b9590ccef9aa7efbaf89a1dd554abb`.
PR #10 merged the programme record as `d094e0add943b8bf1d9c8adc43274190c9dd2f63`.

The app calls companies Businesses and deals Opportunities.
Business and contact sheets expose relationships and assignments.
Filters cover vertical, entity type, lifecycle, role, and region.
Today, Coverage, and Domain Review views exist.

Phase 3 visual finishing remains open.
The CRM must adopt the current light AI See You Production visual system.
It must preserve CRM workflows and information density.
The inherited dark theme, system switching, and theme toggle must go.
No search exclusion metadata exists yet.

### Phase 4: started, with no real data loaded

PR #11 teaches the research agent to read the Phase 2 travel graph.
It adds current relationships, verticals, entity types, and responsible people to agent reads.
It keeps all structural travel data outside agent write authority.
It makes `record_job_change` refuse uncertain moves within related businesses.

No import script exists. The initial target universe has not been supplied.
Gmail and Calendar are not connected for processing.
No private correspondence has entered the programme.

## Pull requests

### Open

PR #11, `Phase 4: teach the research agent the travel model`, is open against `release`.
Its branch is `phase-4/agent-sees-the-travel-model`.
GitHub reports it mergeable with a clean merge state.
The prior product head passed CI and all three Vercel checks.
Checks for the handover-only head started after the final push and remain pending at session close.
GitHub records no submitted review and no code review comments.
The only PR comment is the Vercel deployment report.

### Merged

| PR | Purpose | Merge commit |
| --- | --- | --- |
| #1 | Phase 0 fork hygiene | `f6888b58da979f02590ab135c9e4d05678efeadd` |
| #2 | Database URLs and Sydney API region | `fb34ef5741c01766875ca0686d6d5e97b617271b` |
| #3 | Deployment topology | `b7f5688482cf191ca4d00a50eaa65d9338780517` |
| #4 | API Build Output deployment | `c9977fa16f503dca785cfd43d080b6ad9eb47a6c` |
| #5 | Travel data architecture | `a90f759f9a8ac3f9cf33d63dc69a5119fa0ebc0e` |
| #6 | Verified database TLS | `8896a53515a604bb023472b4d104e54986d796f1` |
| #7 | App build access to API URL | `ed425e48ab60facf143a8bb27ad36fca3936f748` |
| #8 | Identity-only Google sign-in | `88f9d05ef9711dc218d18f05af1037d88f461fc7` |
| #9 | Phase 3 founder interface | `d6280c2901b9590ccef9aa7efbaf89a1dd554abb` |
| #10 | Phase 1 to 3 programme record | `d094e0add943b8bf1d9c8adc43274190c9dd2f63` |

There are no other open pull requests.

## Deployed state

The AI See You Vercel team has an active Pro plan.
The founder approved this plan for minute-level schedules and production operation.

| Project | Repository root | Production domain | Verified response |
| --- | --- | --- | --- |
| `crm-app` | `apps/app` | `crm.ai-seeyou.com` | Protected route redirects to `/sign-in` |
| `crm-api` | repository root | `api.crm.ai-seeyou.com` | `/health` returns 200 |
| `crm-agent` | `apps/agent` | `agent.crm.ai-seeyou.com` | `/eve/v1/info` returns 401 without authentication |

All three latest production deployments report Ready.
All three custom domains resolve through Vercel DNS CNAME records.
The earlier DNS blocker is resolved.

The API runtime is pinned to `syd1` in `apps/api/vercel.json`.
Live API and app requests report `syd1` execution.
Vercel project inspection reports the default sandbox region as `iad1`.
Do not confuse that project setting with the API function region.

Production environment variable names exist for database access, authentication, OAuth, telemetry, and service URLs.
Secret values were not downloaded during this handover.

## Supabase and migrations

The CRM Supabase project is `AI See You CRM`.
Its project reference is `oobfqkcqcdsbcnapegyk` in `ap-southeast-2`.
The Data API has an empty exposed schema and remains disabled.

The repository contains 64 migration directories.
The latest is `20260905080000_defer_research_key`.
Release production deployments succeed after the API build runs `prisma migrate deploy`.
This handover did not query the hosted migration table directly.
Therefore, production migration parity is supported by deployment evidence, not a direct database status command.

No Phase 4 schema change exists. PR #11 changes only agent code and tests.

## Authentication and search state

The only authorised V1 user is `dave@ai-seeyou.com`.
Do not allow the entire `ai-seeyou.com` domain.
Google OAuth remains the only intended sign-in method.
Do not expose registration or invitation workflows.
Dave must remain the sole workspace owner and administrator.

Unauthenticated access to a protected app route redirects to `/sign-in`.
Unauthenticated access through the app tRPC proxy returns `401`.
The agent information route also returns `401`.

The deployed Google OAuth route starts successfully.
Authorised and rejected Google account tests remain incomplete.
Existing production user and membership rows were not safely inspected during this handover.
Remove or disable every non-founder user before real data loads.

The app has no `noindex, nofollow` metadata today.
No public sitemap or navigation audit has confirmed exclusion.
The public AI See You website must not link to the CRM.

## Test and CI state

PR #11 product code passed `check-types`, lint, and tests before the handover commit.
Its PR description records a reset test database and 388 passing agent tests.
All three Vercel preview checks pass.

This coordinator ran the Phase 4 type check successfully.
Five static write-boundary tests passed locally.
Four database-backed tests failed before execution because local Postgres refused the connection.
No product assertion failed in that local attempt.
The final pre-push hook accepted cached green type, lint, and full-suite results.

The local Homebrew Postgres service is currently unavailable.
Tests require a separate `TEST_DATABASE_URL` ending in `_test`.
Never bypass that guard or use the hosted CRM database for destructive integration tests.

One inherited agent test remains intermittently unstable during a full run.
It passes alone and predates Phase 3.

## Founder rulings

1. Production defines what a travel business is.
2. CRM defines the commercial relationship with that business.
3. CRM never writes Production.
4. Supabase is managed Postgres only.
5. Keep Prisma and Better Auth.
6. Do not use Supabase Auth, Realtime, or Edge Functions.
7. CRM access is founder-only.
8. The only authorised CRM user is `dave@ai-seeyou.com`.
9. Do not allow the whole `ai-seeyou.com` domain.
10. Do not expose public registration or invitation flows.
11. Use `noindex, nofollow` and publish no public CRM links.
12. Use the light AI See You visual system after inspecting Production's current frontend.
13. Preserve CRM information density and workflows during visual finishing.
14. Context.dev is deferred.
15. Clay is deferred until its approved enrichment phase.
16. Gmail, Calendar, and private correspondence await the model and privacy decision.
17. Outbound email awaits separate founder approval.
18. Vercel Pro is approved and active.
19. Cruise and Tour Operators stay supported without current real data.

## Known limitations and deferred work

1. The initial target universe has not been supplied.
2. Production read integration does not exist.
3. Email attribution still uses the contact's single employer.
4. Property correspondence can file against a group instead of the property.
5. PR #11 provides agent travel-model visibility but remains unreviewed and unmerged.
6. Coverage evaluates only the first 200 target businesses.
7. Coverage reports truncation, but summary coverage counts describe only the examined page.
8. Today uses creator ownership for tasks and owner ownership for opportunities.
9. Today assigns replies by the mailbox user who synced each inbound message.
10. This reply scope is not a commercial account ownership model.
11. Domain Review returns at most 200 rows and has no pagination cursor.
12. Domain Review moves only unassigned contacts matching the exact email domain.
13. A dismissed review stays dismissed. No reopen action exists.
14. Relationship rows for archived businesses can still render as live.
15. The contact sheet loads all assignments without a cap.
16. The six Phase 3 routers lack HTTP-level test coverage.
17. Context.dev remains optional and unconfigured.
18. Gmail and Calendar processing remain blocked.
19. Outbound email, campaigns, sequences, and marketing suppression do not exist.
20. Clay and its scoped intake credential do not exist.
21. Search exclusion and the public-link audit remain incomplete.
22. The inherited dark visual system and theme toggle remain.
23. Shared UI files still contain many dark-mode variants.
24. Some runtime text still names Comp AI, especially agent and Slack paths.
25. Test fixtures and historical documentation still contain upstream names.
26. `posthog-node` remains installed, but telemetry cannot send.
27. Around 240 files still contain dash characters from inherited text.

## FOUNDER ACTION REQUIRED

1. Supply the initial target universe when import work is ready.
2. Decide which model can process Gmail, Calendar, and private correspondence.
3. Complete one interactive sign-in with `dave@ai-seeyou.com` after access hardening deploys.
4. Provide explicit approval before any outbound email capability begins.

No founder action is required to review, merge, or finish routine engineering work.

## Next recommended execution sequence

1. Independently review PR #11.
2. Fix review findings, rerun the full suite, and merge PR #11 when clean.
3. Create a focused founder-access branch from the updated `release` branch.
4. Set `ALLOWED_SIGN_IN` to `dave@ai-seeyou.com` across all production projects.
5. Remove or disable every other production user and membership.
6. Remove public registration and invitation surfaces.
7. Add `noindex, nofollow` metadata and sitemap exclusion.
8. Test the authorised email, another company email, an unrelated account, and unauthenticated access.
9. Inspect the current Production frontend and record its visual tokens.
10. Complete the light-only Phase 3 visual finish through shared UI sources.
11. Restore local Postgres and rerun all tests.
12. Await the target universe before building the real-data importer.
13. Keep mailbox processing blocked until the founder chooses the model and privacy boundary.

The exact next technical milestone is founder-only access hardening with four independent acceptance tests.

## NEXT COORDINATOR MANDATE

Own routine engineering autonomously.
Review and merge PR #11 after evidence confirms it is safe.
Then complete founder-only access, search exclusion, and the light-only visual finish.
Keep each change on a focused branch with independent review and green CI.

Do not ask Dave to repeat decisions recorded here.
Escalate only model privacy, outbound email approval, target-universe delivery, or a new Production boundary decision.
Never broaden a phase, connect private correspondence, or add a Production write path without explicit authority.

## Verification record

GitHub verification used repository, pull request, review, check, branch, and release APIs.
Vercel verification used project inspection, deployment lists, environment-name lists, and live HTTPS requests.
DNS verification resolved all three custom domains through Vercel.
Repository verification inspected branches, commits, migrations, auth code, UI metadata, and Phase 3 services.
Hosted database secrets were not downloaded.
The hosted migration table and production user rows remain directly unverified.
