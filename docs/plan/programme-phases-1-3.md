# AI See You CRM: programme state, Phases 1 to 3

This is the coordinator's working document. It records what is done, what is in
progress, and what each child workstream owns. The architecture it implements is
`docs/ai-see-you-crm-foundation-audit.md`, sections H and R. That document wins on
every question of design.

## Standing rules

1. The CRM never writes AI See You Production. No credential, no client, no path.
2. `DATABASE_URL` points at the dedicated AI See You CRM Supabase project, or at a
   local Postgres. Never Production. Never the Research Lab.
3. Telemetry stays off.
4. Additive, file-local changes. The fork must keep merging from upstream.
5. No em dashes, no en dashes, anywhere.
6. No code comments except ones that record a decision somebody would undo.

## Environments

| Thing | Value |
| --- | --- |
| Repository | `ai-seeyou/ai-see-you-crm` |
| Canonical branch | `release` |
| Phase 0 merge | `f6888b5` |
| CRM Supabase project | `AI See You CRM`, ref `oobfqkcqcdsbcnapegyk`, `ap-southeast-2` |
| CRM Supabase Data API | Disabled. `db_schema` is empty. Verified 5 Sep 2026. |
| Local Postgres | Homebrew `postgresql@16` on `localhost:5432`, databases `crm` and `crm_test` |
| Vercel region | `syd1`, pinned for the API in `apps/api/vercel.json` |

## Phase 1: run it, locally then deployed

### 1a, local. Done, 5 Sep 2026

- `bun install` clean.
- 56 migrations applied to the local `crm` database.
- Seed wrote 15 companies, 45 contacts, 23 deals, 159 activities.
- `bun run build` passes. `bun run check-types` passes.
- `bun run test` passes, 0 failures, after `bun run db:test` created `crm_test`.
- API `GET /health` returns `{"status":"ok","database":"up"}`.
- App `GET /` redirects to `/sign-in`. The sign-in page renders as
  `Sign in - AI See You CRM`.
- A local session comes from `apps/api/scripts/dev-session.ts`. It needs no
  Google OAuth client, so UI verification does not wait on one.

Two local environment facts, both discovered the hard way:

- **The local Postgres must run in UTC.** `docker-compose.yml` and CI both use the
  `postgres:17-alpine` image, which is UTC. A Homebrew cluster inherits the
  machine's zone. Prisma maps `DateTime` to `timestamp(3)`, which has no zone, so
  a `NOW()` written by raw SQL lands ten hours ahead of a date written by Prisma
  and `apps/agent/test/keyless-brand.integration.spec.ts` fails on a comparison
  that is correct. Fix: `ALTER SYSTEM SET timezone = 'UTC'` then reload.
- **`.env` needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, even fake ones.**
  `apps/api/test/auth.e2e.spec.ts` asserts the sign-in page offers Google. CI sets
  placeholder values for this reason. Without them the suite fails locally and
  passes in CI.

### 1b, deployed. Done

Three Vercel projects on the `AI See You` team, all three git-connected to
`ai-seeyou/ai-see-you-crm` with `release` as the production branch, all three
pinned to `syd1`, next to the database in `ap-southeast-2`.

| Project | Root directory | Build | Output | Address |
| --- | --- | --- | --- | --- |
| `crm-app` | `apps/app` | Next.js preset | Next.js | `crm.ai-seeyou.com` |
| `crm-api` | `apps/api` | `node scripts/build-func.mjs` | `.vercel/output` | `api.crm.ai-seeyou.com` |
| `crm-agent` | `apps/agent` | `bun run build` (`eve build`) | `.vercel/output` | `agent.crm.ai-seeyou.com` |

Each project runs `npx turbo-ignore <workspace>` as its ignored build step, so a
push that touches one application does not rebuild the other two.

#### Why the CRM sits on its own parent domain

Better Auth mints the session cookie at `API_URL`, and every OAuth `redirect_uri`
is built from `API_URL`, never from `APP_URL`. The browser therefore lands on the
API origin during sign-in, so the app and the API must share a cookie parent.
`.vercel.app` is on the Public Suffix List and cannot be a cookie domain, so the
custom domains are load bearing, not cosmetic.

`AUTH_COOKIE_DOMAIN` is `.crm.ai-seeyou.com`, not `.ai-seeyou.com`. A cookie scoped
to the apex would be sent to `app.ai-seeyou.com`, which is AI See You Production.
The CRM session token must never reach another application. The extra label keeps
it inside the CRM.

#### Database connection

The direct host `db.<ref>.supabase.co` resolves to IPv6 only and is unreachable
from here and from Vercel. Both URLs therefore go through the Supavisor pooler at
`aws-0-ap-southeast-2.pooler.supabase.com`:

- `DATABASE_URL` is the transaction pooler on port 6543 with `pgbouncer=true`.
- `DIRECT_DATABASE_URL` is the session pooler on port 5432, which `prisma migrate
  deploy` needs and which the transaction pooler cannot serve.

`apps/api/scripts/build-func.mjs` runs `prisma migrate deploy` during the `crm-api`
build, gated on `VERCEL_ENV === "production"`. The schema therefore moves when a
pull request merges to `release`, with the code that needs it, and once.

#### Still outstanding

1. Three DNS records at the registrar, which holds the nameservers for
   `ai-seeyou.com`. There is no wildcard, so each subdomain needs its own record.
2. A Google OAuth client, for sign-in only. The redirect URI is
   `https://api.crm.ai-seeyou.com/api/auth/callback/google`.

Gmail and Calendar reading stays off until the founder approves it. That is a
separate decision and a Phase 4 item.

## Phase 2: the travel data architecture. Done and merged

Audit section H.3 and H.4, in the migration order the audit gives. Merged as
pull request 5. `Company` stays the physical table, no column was removed, and
`Contact.companyId` still works for every inherited query.

| # | Migration | State |
| --- | --- | --- |
| 1 | `Vertical`, `Company.verticalId`, `Company.entityType`, four verticals seeded | Done |
| 2 | `EntityRelationship`, `RelationshipType`, partial unique on `validTo IS NULL` | Done |
| 3 | `ContactAssignment`, its enums, the backfill, and the synchronisation rule | Done |
| 4 | `ExternalRef` and its enums, unique in both directions per system | Done |
| 5 | `Company.domain` uniqueness dropped, `companyForEmail` proposes | Done |
| 6 | Travel `DealStage`, `OpportunityEntity`, travel `FieldDefinition` seeds | Done |
| 7 | Integrity checks: no self-relationship, no inverted period, primary means employer | Done |

Refused by design, and still refused: a `parentId` tree, Production identifiers
stored as custom fields, any Production write path.

### Where the synchronisation rule lives

In the database, as a trigger on `contact`, not in a service. `Contact.companyId`
is written by tRPC, by the bulk editor, by the mailbox match, by the tracking
filing, by agent tools and by the seed. A service covers only the callers that
remember to call it, and `contacts.bulkSetCompany` is exactly the one that would
have been forgotten. The reverse direction is `ContactAssignmentService`, the only
writer of that table.

### Acceptance

`apps/api/test/travel-model.integration.spec.ts`. One hotel group, one management
company, three properties, two of which share the group's corporate domain and
stay distinct businesses. Typed relationships read in both directions. One group
Director of Distribution employed at the group and responsible for all three
properties, found from either end. Both `ExternalRef` uniqueness directions. One
group-level opportunity covering three properties.

Independent review refused it the first time. The model passed; the product did
not, because `CompaniesService.create` still rejected a second business on one
domain and the acceptance test wrote straight to Prisma and never met the guard.
The test goes through the service now.

## Phase 3: make it useful. Done and merged

Audit section R items 18 to 22. Merged as pull request 9.

- Company reads as Business and Deal reads as Opportunity, from `apps/app/lib/labels.ts`.
  No identifier moved: route segments, the `RecordKind` union, tRPC aliases, REST
  paths, Prisma names, `FieldEntity`, saved-view facet ids and the agent bridge
  headers are byte-identical to before, and so is `schema.prisma`.
- Six tRPC modules: `relationships`, `assignments`, `verticals`, `today`,
  `coverage`, `domainReviews`.
- The business sheet has Relationships and People responsible, and vertical and
  entity type as editable fields. The contact sheet has Responsible for.
- Filters for vertical, entity type and role type. Lifecycle stage and region
  already worked through the custom-field pipeline.
- `TODAY` and `COVERAGE`, and the domain review queue that Phase 2's proposals
  needed.

Thresholds live in `apps/api/src/today/today-config.ts`, the required-role matrix
in `apps/api/src/coverage/coverage-config.ts`. Both are one `as const` object so a
new entity type is a compile error rather than a silent gap.

## Two deliberate departures from upstream

Both were founder decisions, both are recorded where the code is.

1. **The Context.dev research key can be skipped.** Upstream's onboarding gate
   cannot be passed without one, so a workspace that has not bought a key cannot
   use the CRM at all. `appSetting.contextDevDeferredAt` records the moment
   somebody chose to go on without one.
2. **Sign-in asks for identity, not for a mailbox.** Upstream requested
   `gmail.readonly` and `calendar.readonly` at sign-in and walled anybody who
   declined, so signing in and handing the CRM a mailbox were one act. They are
   two decisions. Settings, Connections still passes `SYNC_SCOPES` to
   `linkSocial`, so no capability was lost.

## What review found that we would have shipped

Every one of these was found by an agent that did not write the code.

- The Coverage view was not in the repository. An unanchored `coverage` pattern in
  `.gitignore` hid it, a committed file imported it, and the branch did not compile
  from a clean checkout. The negation needs `\[slug\]` escaped or it does nothing.
- The product refused to put two hotels on one corporate domain while the
  acceptance test passed.
- An invalid filter value returned HTTP 500 carrying an absolute server path.
- Coverage called a role filled before the person started, and a gap once a
  leaving date was recorded. A future end date also freed the uniqueness slot.
- A decided domain review accepted a second decision and lost the first.
- `mailboxGrantsNeeded` stopped answering as soon as any non-mailbox account
  existed, which the sign-in change turned from latent into live.

## Open, and deliberately not done

- Connecting Gmail is blocked on a founder decision about which model processes
  private correspondence. The inherited default is GLM 5.2 through the Vercel AI
  Gateway, which nobody here chose.
- The research agent cannot see verticals, entity types, relationships or
  assignments. Its read tools select fixed field lists.
- Email about a property still files against the group, because attribution reads
  a contact's single employer.
- Coverage stops at 200 target businesses and says so.
- A relationship to an archived business renders as live.
- The contact sheet loads every assignment with no cap.
- No HTTP-level test covers the six new routers.
- Thirty two `className` overrides sit on shared components, against
  `docs/design.md`. The pattern is inherited.
- Around 240 files still contain dashes. The product displays none of them.
- One agent test fails intermittently in a full run and passes alone. It predates
  Phase 3 and survived 24 attempts to reproduce it.

## Programme exclusions

Not in this programme: Clay, real hotel or contact import, the Production read
API, Production synchronisation, Gmail sending, automated outreach, campaigns,
sequences, suppression, website tracking activation, Slack activation, cruise
import, tour operator import. The schema supports future verticals. This
programme does not populate them.
