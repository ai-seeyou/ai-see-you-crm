# AI See You CRM: Foundation Audit and Target Architecture

**Repository audited:** `ai-seeyou/ai-see-you-crm` (fork of `trycompai/crm`)
**Branch:** `release` at `6d4793d` (upstream release 1.15.3, 2026-08-21)
**Fork divergence:** none. Zero AI See You commits. The tree is byte-identical to upstream.
**Date of audit:** 5 September 2026
**Status:** audit and architecture only. No code written, no schema changed, no service connected.

## Scope and method

This document was produced by reading the repository only. Nothing was executed against a
database, no Supabase project was contacted, no Clay workspace was queried, no Google or
Microsoft account was connected, and nothing was deployed. The Supabase assessment in
section G is reasoned from the code the application actually runs, not from inspecting the
new project.

Every recommendation carries one of six classifications:

| Tag | Meaning |
| --- | --- |
| **KEEP** | Use as inherited. No change. |
| **ADAPT** | Genuinely reusable, but needs modification for AI See You. |
| **REPLACE** | The idea is right, the inherited implementation is not. |
| **REMOVE** | Delete. It is upstream's business, not ours. |
| **DEFER** | Do not touch in V1. Revisit when a real constraint arrives. |

---

# A. Executive summary

**What we inherited is better than expected, and wrong in one specific place that matters
more than everything else combined.**

The good news, stated plainly. This is not a thin CRM template. It is a well engineered,
opinionated, three-deployment application with a real research agent, a real evidence
model, a real work queue, and unusually disciplined documentation. Roughly 60,000 lines
across a Turborepo monorepo: a Next.js front end, a NestJS API serving tRPC plus a
generated REST bridge, a separate durable agent built on Vercel's `eve` framework, Prisma
over Postgres, Better Auth for identity, and 57 migrations of accumulated schema. The
engineering standard is high. The parts we would most struggle to build ourselves, the
durable work queue, the evidence ledger, the agent sandbox, the mailbox sync, the custom
agent builder with a human approval boundary, are exactly the parts that are best built.

The bad news, equally plainly. **The data model cannot represent the AI See You universe.**
Not "would need extending". Cannot represent. Three hard constraints in
`packages/db/prisma/schema.prisma` break on our first real hotel group:

1. **A contact belongs to exactly one company.** `Contact.companyId` is a single nullable
   foreign key (schema line 361). A Group Director of Distribution responsible for 180
   properties has no way to be attached to 180 records. This is your stated requirement
   and the inherited model has no seat for it.
2. **A company has no type and no parent.** There is no hierarchy, no self relation, no
   discriminator. A hotel, a hotel group, a management company and an ownership group are
   all the same flat `Company` row with the same fields. `belongs_to`, `brand_of`,
   `managed_by`, `owned_by`, `operated_by` have nowhere to live.
3. **`Company.domain` is globally unique.** A partial unique index over active rows
   (schema line 313). Forty Accor properties that all publish `accor.com` addresses can be
   one row in this CRM, not forty. Worse, `CompanyDirectoryService.companyForEmail`
   (`apps/api/src/companies/company-directory.service.ts:13`) will silently auto create
   one group level company from the first inbound email and file every property contact
   under it.

There is a second, quieter finding. **The inherited CRM has no outreach capability at all.**
Not weak outreach. None. The Google scope is `gmail.readonly` and the Microsoft scope is
`Mail.Read` (`packages/auth/src/scopes.ts:16-21`). There is no sending path, no sequence
engine, no campaign object, no unsubscribe handling, no bounce handling and no send limits
anywhere in the repository. `SuppressedContact` and `SuppressedDomain` exist but they are
inbox filtering and delete tombstones, not marketing suppression. The word "campaign" in
this codebase means a UTM parameter. If AI See You intends automated outreach, that is a
build, not a configuration.

The recommendation. **Keep the repository. Adapt the data model additively. Do not rewrite.**
The correct move is to treat `Company` as the physical table for a new logical concept,
Business Entity, and add four things beside it: an entity type, a typed relationship edge
table, a contact-to-entity assignment join, and an external reference table that is the
single link to Production. That is roughly four migrations and touches perhaps fifteen
files. The alternative, replacing `Company` with a new `BusinessEntity` model, touches
every router, every service, every agent tool, every table column and every test in the
repository, and buys a cleaner name for a table.

On Supabase, my recommendation is **use the project, but only as managed Postgres.** The
application expects plain Postgres 17 with no extensions and no Supabase-specific feature.
It will run on the new project with two connection string changes. But Supabase Auth,
Realtime, Edge Functions and the PostgREST Data API are all the wrong answer here, and the
Data API in particular is a live data leak risk in an application that has no row level
security because it has never needed any. Section G is the full argument, including the
case for not moving at all.

On the founder's nine V1 questions: seven of them are answerable with the inherited
software plus the data model work above. Two of them, "who have we contacted" and "what
happened", require outreach logging that does not exist yet. Section L scopes the smallest
honest V1.

**Three things to decide before any code is written.** They are in section Q, but the
sharpest one is this: this development environment currently has a Supabase MCP server
named `supabase-production` attached with `execute_sql` available. That is a live,
one-tool-call path from an agent session into AI See You Production. Your instruction was
"do not modify Production". The environment does not currently enforce that instruction.
Detach it or restrict it to read-only before the first implementation session.

---

# B. Existing architecture

## B.1 Shape

A [Turborepo](https://turborepo.dev) monorepo on Bun 1.3.12, Node 22+, TypeScript
throughout, three deployable units plus five shared packages.

| Path | What it is | Port | Deploy target |
| --- | --- | --- | --- |
| `apps/app` | Next.js 16.3 App Router front end | 3000 | Vercel |
| `apps/api` | NestJS 11 API: HTTP, auth, tRPC, mailbox sync | 3001 | Vercel (single serverless function) |
| `apps/agent` | The research agent, `eve` framework | 2000 | Vercel (own deployment) |
| `packages/db` | Prisma schema, 57 migrations, shared client | | |
| `packages/auth` | Better Auth config, sign-in allow list | | |
| `packages/ui` | shadcn/ui components, Tailwind 4 theme | | |
| `packages/env` | Loads the single root `.env` | | |
| `packages/validation` | Shared zod schemas | | |
| `packages/telemetry` | Anonymous usage reporting to upstream | | |

The three deployments share exactly two secrets: `DATABASE_URL` and `BETTER_AUTH_SECRET`.
The API mints the session cookie, the app verifies it. Everything else is optional.

**Classification: KEEP.** The separation is correct and is the reason the agent can keep
working with the browser closed. Do not collapse these into one Next.js app.

## B.2 The front end, `apps/app`

Next.js 16 App Router. Routes are nested under a cosmetic workspace slug
(`app/(app)/[slug]/companies`, `.../contacts`, `.../deals`, `.../agents`,
`.../settings/*`). Data comes over tRPC with TanStack Query. List state (filters, sort,
page) lives in the URL via `nuqs`, so a view is a shareable link. There are three landing
routes outside the app shell: `/sign-in`, `/onboarding`, `/grant-access`.

Two proxy routes matter architecturally:

- `apps/app/app/api/[...path]/route.ts` proxies to the API.
- `apps/app/app/eve/v1/[...path]/route.ts` is the agent bridge. It is an **enforcement
  point, not a passthrough**: it checks the Better Auth session, strips the cookie, and
  mints a two-minute HS256 token naming the rep and the record. The agent never sees a
  session cookie.

There is also a website tracking script served at `app/t/crm.js` and a collector at
`app/t/[site]`.

**Classification: ADAPT.** The shell, tables, record sheets and filter bar are directly
reusable. The UI vocabulary (Companies, Contacts, Deals) will need renaming and a fourth
record kind for relationships. `docs/design.md` states that `packages/ui` is the only
source of UI and there is no overriding styles at the call site. Hold to that.

## B.3 The API, `apps/api`

NestJS 11 with `nestjs-trpc`. 21 routers, 8 REST controllers.

**tRPC is the data surface. REST is auth, health and internal cron only.** Every router is
`*.router.ts`, decorated `@Router({ alias })` and `@UseMiddlewares(AuthMiddleware)`. The
documented rule in `docs/api.md` is severe and worth repeating: **no `AuthMiddleware` means
public, and there is no other guard.** There is exactly one public procedure in the
application, `sso.signInOptions`.

**A generated REST bridge exists and is the single most useful inherited feature for our
Clay plans.** Every tRPC procedure carrying `restMeta(...)` (`apps/api/src/trpc/openapi.ts`)
is also exposed under `/rest/*`, and `GET /openapi.json` serves the merged document at
runtime. So `POST /rest/companies`, `PATCH /rest/companies/{id}`, `POST /rest/contacts`
and dozens more already exist as authenticated REST endpoints, with an OpenAPI description
Clay can import. Nothing needs building to give Clay a door.

Internal cron controllers, all guarded by `CRON_SECRET`:

| Route | Schedule | Purpose |
| --- | --- | --- |
| `POST /internal/sync/mailboxes` | `*/5 * * * *` | Gmail and Outlook sync |
| `POST /internal/sync/rates` | `0 6 * * *` | FX rates |
| `POST /internal/telemetry/rollup` | `0 7 * * *` | Usage report to upstream |
| `POST /internal/tracking/retention` | `0 4 * * *` | Delete page views over 90 days |
| `POST /internal/archive/prune` | `0 5 * * *` | Purge records archived past retention |

Registered in `apps/api/vercel.json`.

**The load bearing architectural rule of this repository:** *intelligence never lives in
the API* (`docs/api.md`). Nest reports that something happened by writing a row. The agent
decides what it means. The API owns no vendor client, no scoring, no identity matching. The
one documented exception is the exchange rate fetcher. **This rule is why the fork is worth
keeping, and we must hold to it.** Clay must be called from `apps/agent`, never from
`apps/api`.

**Classification: KEEP** the architecture. **ADAPT** the routers as the data model grows.

## B.4 Build and deployment

`apps/api/scripts/build-func.mjs` bundles the whole NestJS app into one Vercel serverless
function under `.vercel/output/functions/api/index.func`, vendoring a hand maintained
`EXTERNALS` and `VENDOR_ROOTS` list because Nest declares runtime needs as peer
dependencies. **This is fragile and is documented as such.** Adding a dependency without
checking it lands in `.vercel/output` produces a build that stays green and throws
`MODULE_NOT_FOUND` on the first production request.

The same script runs `prisma migrate deploy` at build time, but only when
`VERCEL_ENV === "production"`, using `DIRECT_DATABASE_URL`, falling back through
`POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED`, then `DATABASE_URL`. It then runs
`prisma migrate diff --exit-code` to detect drift. **This is directly relevant to Supabase:
we set `DATABASE_URL` to the pooled connection and `DIRECT_DATABASE_URL` to the direct one,
and it works as designed.**

`apps/api/src/generated/server.ts` is generated and committed and the build must never
regenerate it. The generator needs GLIBC 2.39, newer than the Vercel build image.

**Classification: KEEP,** with a documented risk (section P).

## B.5 Local development

`docker-compose.yml` runs Postgres 17 Alpine on 5432. `bun run dev` prepares the database
and runs all three apps in watch mode. `bun run db:seed` produces a demo pipeline.

One inherited behaviour is worth knowing before the first dev session: **`eve dev` never
fires schedules on their cron cadence.** Work queues and nothing dispatches. The mitigation
is the dispatch poke (`POST /internal/crm/dispatch`), which only fires when
`AGENT_BRIDGE_SECRET` is set, or `bun run --filter=agent dispatch` by hand.

**Classification: KEEP.**

---

# C. Existing data model

`packages/db/prisma/schema.prisma`, 1,585 lines, 57 migrations, Prisma 7.9 with the
`@prisma/adapter-pg` driver adapter and the `partialIndexes` preview feature. Postgres
only. **No Postgres extensions are created by any migration.** No `pg_trgm`, no `tsvector`,
no `uuid-ossp`, no PostGIS. Ids are `cuid()` strings.

## C.1 Identity and tenancy

`User`, `Session`, `Account`, `Verification`, `RateLimit`, `SsoProvider`, `Apikey`,
`Organization`, `Member`, `Invitation`. All Better Auth managed.

**There is no tenancy.** `docs/api.md` states it as a deliberate decision: no
`organizationId` on any CRM record, no org header, no org interceptor. A singleton
`Organization` row exists with the literal id `"workspace"` (`packages/db/src/workspace.ts:11`)
and answers only three questions: what are we called, who works here, what do we sell.
`ensureWorkspaceMembership` runs on session create and degrades rather than throwing.
Roles are `owner`, `admin`, `member`.

**This is correct for AI See You and should not be changed.** We are one company selling to
travel businesses. Adding tenancy would be a column, an index and a permissions check that
buys nothing. **Classification: KEEP.**

## C.2 Company

Schema lines 250 to 320. A flat record:

- Identity: `name`, `domain`, `website`, `description`
- Brand: `logoUrl`, `logoDarkUrl`, `iconUrl`, `iconDarkUrl`, `iconTone`, `brandColor`
- Classification: `industry`, `subIndustry`
- Location: `city`, `stateCode`, `country`, `countryCode`
- Channels: `phone`, `email`, `linkedinUrl`, `twitterUrl`, `githubUrl`, `pricingUrl`, `careersUrl`
- Ownership: `ownerId` to `User`, `primaryContactId` to `Contact`
- Enrichment: `enrichmentStatus` (PENDING, RUNNING, COMPLETE, FAILED, SKIPPED), `enrichedAt`, `enrichmentError`, one to one `CompanyEnrichment` holding the raw vendor JSON
- Lifecycle: `source` (MANUAL, IMPORT, EMAIL, CALENDAR, TRACKING), `lastActivityAt`, `archivedAt`

**Critical constraint:** `@@unique([domain], map: "company_domain_active_key", where: { archivedAt: null })`.

**There is no `type`, no `parentId`, no self relation and no external id field.**

**Classification: ADAPT.** See section H.

## C.3 Contact

Schema lines 322 to 400.

- Person: `firstName`, `lastName`, `email`, `phone`, `title`, `seniority`, `function`
- Social: `linkedinUrl`, `twitterUrl`, `githubUrl`, `imageUrl`, `socialsCheckedAt`
- Links: `companyId` (nullable, `SetNull`), `ownerId`, `primaryOf`
- Enrichment: same triple as Company, plus `ContactBrief` (a narrative) and `ContactFact[]`
- Joins: `DealContact[]`, `Activity[]`, `EmailThread[]`, `CalendarEvent[]`,
  `CalendarAttendee[]`, `FieldValue[]`, `TrackedVisitor[]`, `FormSubmission[]`

**Critical constraint:** `@@unique([email], map: "contact_email_active_key", where: { archivedAt: null })`,
and `companyId` is **one** company.

**Classification: ADAPT.** The person record itself is fine. The single employer link is
the blocking problem.

## C.4 The evidence ledger, `ContactFact` and `ContactBrief`

Schema lines 402 to 465. **This is the most valuable single thing in the fork and we should
protect it.**

```
ContactFact {
  contactId, field, value,
  score Float, band FactBand,     // VERIFIED | PROBABLE | POSSIBLE
  evidence Json, method String, sourceUrl String?,
  status FactStatus,              // APPLIED | PROPOSED | DISMISSED | SUPERSEDED
  decidedById, decidedAt, observedAt, supersededAt
}
```

The fields the agent may assert are fixed in `apps/agent/agent/lib/facts.ts:6`: `name`,
`title`, `linkedinUrl`, `twitterUrl`, `githubUrl`, `employer`, `seniority`, `function`,
`location`, `tenure`. Five of those map to a real column, five do not.

**No tool accepts a confidence score.** Tools report what they observed, and
`apps/agent/agent/lib/evidence.ts` prices it. The observation vocabulary is closed:
`linkedin.employer-and-name`, `crm.thread-reply`, `crm.signature-block`,
`github.account-identity`, `crm.meeting-attendance`. Weights are combined multiplicatively
and at least one **primary** source is required before anything can be written.

`lib/facts.ts` is the only write path to a contact's fields and enforces three rules a
prompt cannot: never overwrite a human, never re-offer a dismissal, never write without a
primary source. `PROBABLE` fills a blank field automatically but requires a human decision
when a value is already there.

**Classification: KEEP, and extend.** Clay outputs should become facts with new
`clay.*` observation kinds priced below primary sources, not direct column writes.
This is the single most important design decision in the Clay integration.

## C.5 Deal

Schema lines 915 to 970. `DealStage` is a fixed enum: `DEMO_BOOKED`,
`QUALIFIED_TO_BUY`, `UNQUALIFIED_TO_BUY`, `DECISION_MAKER_BOUGHT_IN`, `CONTRACT_SENT`,
`CLOSED_WON`, `CLOSED_LOST`. There is dual currency accounting (`amount` and `currency`
sold, `baseAmount`, `baseCurrency`, `fxRate`, `fxRateAt` reported) with the rule that
**only `baseAmount` may ever be summed**. `ExchangeRate` holds a keyless feed.

**`Deal.companyId` is required and singular.** `DealContact` is a proper many to many join
with a `role` string.

**Classification: ADAPT.** The stage enum is a B2B SaaS pipeline and is wrong for travel
partnerships, but changing an enum is one migration. The single company link is the same
structural problem as Contact.

## C.6 Activity

Schema lines 1100 to 1145. One table, `ActivityType` enum (`NOTE`, `CALL`, `EMAIL`,
`MEETING`, `TASK`, `STAGE_CHANGE`, `ENRICHMENT`), optional links to company, contact and
deal, `occurredAt` / `dueAt` / `completedAt`, a `meta` JSON blob, and one-to-one optional
links to `EmailThread` and `CalendarEvent`.

Notice what this gives us free: **`TASK` with a `dueAt` and a `completedAt` is a follow-up
queue.** The founder's "who needs following up" question is answerable today.

**Classification: KEEP.** It will need `OUTREACH` and `REPLY` members later.

## C.7 Mail and calendar

`MailboxSync` (one row per user per source: `gmail`, `outlook`, `calendar`),
`EmailThread`, `EmailMessage`, `CalendarEvent`, `CalendarAttendee`.

Two design decisions worth carrying forward:

- **A thread is keyed by RFC message id, not the provider's thread id.** A rep on Gmail and
  a rep on Outlook land on the same `EmailThread`.
- **`ThreadWriterService.store` is the only writer.** Both providers parse down to one
  `IncomingMessage` and hand it over.

**Reading is forward only.** The first sync records the current time and imports nothing.
Connecting an old mailbox does not backfill years of history.

**Classification: KEEP.**

## C.8 Custom fields, the EAV layer

`FieldDefinition` (entity is `COMPANY` | `CONTACT` | `DEAL`, plus `key`, `label`, `type`,
`agentFilled`, `agentBrief`, `showOnSheet`, `showOnTable`, `showOnFilter`, `position`),
`FieldOption`, `FieldValue` (typed columns: `text`, `number`, `date`, `bool`, `optionId`,
`userId`). Types: `TEXT`, `LONG_TEXT`, `NUMBER`, `DATE`, `CHECKBOX`, `SELECT`, `URL`,
`EMAIL`, `PHONE`, `USER`.

`packages/db/prisma/seed.ts:493` already seeds seven company fields: Account type, Segment,
Territory, Lifecycle stage, Lead source, ICP fit score, BDR owner.

**This is a genuine escape hatch and it is tempting.** We could put "Vertical" and
"Production ID" here with zero migrations. **Do not put the Production ID here.** A
`FieldValue.text` has no unique constraint, no foreign key and no provenance, and a
mistyped canonical identifier is a silent, permanent, wrong join between two systems.
Vertical as a `SELECT` field is acceptable as an interim.

`SavedView` stores a named filter set per user with a `shared` flag.

**Classification: KEEP** the machinery. **ADAPT** the seeded field set for travel.

## C.9 Website tracking

`TrackedDomain`, `TrackedVisitor`, `TrackedEvent`, `TrackingCounter`, `TrackedPageDaily`,
`FormSubmission`, plus tracking settings on `AppSetting`. First touch and last touch UTM
attribution, a cookie based visitor id, a form submission intake that can create contacts
under an hourly cap, and a 90 day retention sweep.

**Classification: DEFER.** It works, it is not harmful, and it is not V1. Leave it off
(`AppSetting.trackingPaused`). It becomes genuinely useful when aiseeyou.com starts drawing
hotel traffic. Note that it processes personal data via cookies and would need a consent
banner for EU visitors before it is switched on.

## C.10 Suppression, and what it is not

```
SuppressedDomain { domain, reason, createdAt }
SuppressedContact { email, reason, createdAt }
```

**These are not marketing suppression lists.** They exist for one purpose: when a rep purges
a contact, the address is written to `SuppressedContact` so the mailbox sync does not
recreate them from the next thread. `externalParticipants`
(`apps/api/src/mailbox/participants.ts`) is the only consumer. Adding a contact back lifts
the suppression.

**Do not repurpose these tables for unsubscribes.** They will be cleared by the wrong
action. A real suppression list needs its own table with a reason enum, a source, a
timestamp and an audit trail that survives a contact being re-added. **Classification:
KEEP as-is, and build a separate model.**

## C.11 Telemetry

`Install`, `TelemetryMilestone`, `TelemetryCounter`. Once a day the API posts one event of
banded counts to `https://k.trycomp.ai` with a hardcoded PostHog write key
(`packages/telemetry/src/project.ts`). No names, no addresses, no amounts, IP nulled.
There is also a `posthog-js` client analytics component
(`apps/app/components/landing/analytics.tsx`) which is gated to hostname `trycrm.ai` and so
will never fire for us.

**Classification: REMOVE.** Set `CRM_TELEMETRY_DISABLED=1` in every environment on day one,
then strip `packages/telemetry` and the `posthog-js` dependency in a later cleanup pass. We
should not be reporting our commercial operating tempo to a third party, however anonymous.

---

# D. Existing agent architecture

`apps/agent`, its own deployment, built on **eve 0.29.4**, Vercel's filesystem-first
framework for durable agents. In eve a tool is a file, a skill is a markdown file, a
schedule is a file. Sessions survive redeploys.

## D.1 The root agent

`apps/agent/agent/agent.ts` is 25 lines. The model is dynamic, resolved per session from
`AppSetting.agentModelId`, defaulting to **`zai/glm-5.2-fast`**
(`packages/db/src/settings.ts:11`) with a one million token context window. Session limits:
500,000 input tokens, 50,000 output tokens, a 30 day session timeout.

The model is reached through the **Vercel AI Gateway**, no provider SDK. On Vercel this is
handled by OIDC and needs no key.

**The default model is a founder decision, not a technical one.** `zai/glm-5.2-fast` is a
Z.ai model. Full email bodies of European and Australian hotel executives will be sent to
whichever provider the Gateway routes to. See section Q.

## D.2 Tools, 30 authored

Grouped by what they do:

| Group | Tools |
| --- | --- |
| **Reads (free)** | `read_crm_history`, `read_company_history`, `read_deal_history`, `search_crm`, `list_deals`, `list_outstanding_work`, `list_fields` |
| **Identity** | `identify_contact`, `resolve_linkedin_profile`, `get_linkedin_profile`, `get_contact_work_history`, `find_contact_socials`, `set_contact_socials` |
| **Research (metered)** | `research_person`, `research_company`, `enrich_company` |
| **Writes** | `record_fact`, `record_job_change`, `write_brief`, `write_workspace_profile`, `set_field_value`, `manage_fields`, `archive_field` |
| **Media** | `fetch_contact_photo` |
| **Queue** | `schedule_recheck`, `set_chat_title` |

**Design rule: three records, no dead ends.** Every read hands back the ids of neighbouring
records. A tool result naming a record without its id is treated as a bug, because the only
recovery is asking the human. `search_crm` does **no fuzzy matching** on purpose, because
"Marchetti" reaching "Marchetta" is a wrong record about a real person.

**Classification: KEEP.** These are the right tools and the design rules behind them are
good. They will need entity-aware variants once the relationship graph exists.

## D.3 Four skills

Markdown files the agent reads, versioned like code:
`apps/agent/agent/skills/evidence.md`, `identity-matching.md`, `data-boundaries.md`,
`writing-a-brief.md`.

**Classification: KEEP the mechanism, ADAPT the content.** `identity-matching.md` will need
travel-specific rules (a GM and a Group Director are different people with the same
employer domain). A new `travel-entities.md` skill will be needed to teach the model the
difference between a brand, a management company and an owner.

## D.4 The work queue

`AgentTask` is the queue (schema line 465). Twelve kinds
(`packages/db/src/agent-tasks.ts`): `brand`, `portrait`, `meeting-prep`, `identify`,
`profile`, `recheck`, `company-profile`, `workspace-profile`, `field-backfill`,
`slack-people-match`, `slack-channel-join`, `agent-event`. Each row carries `dueAt`,
`leasedUntil`, `priority`, `budget`, `attempts`, `reason`, `outcome`.

`claimDue` in `apps/agent/agent/lib/tasks.ts:32` is a raw
`UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED)` so two dispatchers take disjoint work
and a run that dies frees its row when the lease expires. `MAX_ATTEMPTS` is 3.

**One schedule, `schedules/dispatch.ts`, running every minute, and it decides nothing.** It
leases what is due and starts a session per row. The stated rule: anything that looks like
"every N minutes, the oldest ten contacts" belongs in a task's `dueAt`, not in a cron
expression.

**Two lanes.** Visible work (`brand`, `portrait`, Slack tasks, agent events) runs directly
with no model at all, 60 per tick, six at a time. Research work runs one eve session per
row, 12 per tick. This exists because logos once queued behind sixty LLM runs for 25
minutes.

Three sweeps run at the top of every tick: `sweepBlankFacts` (apply pending suggestions
into still-blank fields, 2000 scanned, 500 applied per pass), `reconcileStaleTasks` (close
rows that are provably done or dead, 200 per pass), and `retireExhausted`.

**Classification: KEEP.** This is a properly built durable work queue on Postgres and it is
exactly what a founder-led automated commercial operation needs. It generalises to
"enrich this hotel group", "refresh this contact", "check whether this GM still works
there" with no structural change.

## D.5 Sandboxing and permissions

`apps/agent/agent/sandbox/sandbox.ts` is eight lines and sets `networkPolicy: "deny-all"`
on all three backends (Vercel Sandbox, Docker, microsandbox), on the **backend factory** so
it cannot be forgotten per session.

**The sandbox is never given `DATABASE_URL`.** CRM access is only through authored tools
running in the trusted app runtime. The documented reasoning: a shell with credentials and
egress is exfiltration shaped even in an internal tool; a shell with neither is a text
processor. `web_fetch` runs in the app runtime and `web_search` at the model provider, so
deny-all costs nothing.

**Egress rules** (`skills/data-boundaries.md` and `docs/agent.md`): the agent may read
everything including full email bodies, but (1) no customer text in a third-party query,
derived questions only, (2) nothing from a mailbox into `/workspace`, (3) nothing sensitive
logged.

`packages/db/src/safe-fetch.ts` is a full SSRF guard: DNS resolution, private range
blocking for IPv4 and IPv6 including mapped and embedded forms, a redirect cap of 3 and a
5 second timeout. All vendor URL fetches go through it.

**Classification: KEEP. This is genuinely good security engineering and better than we
would build ourselves.**

## D.6 The custom agent builder, the largest inherited subsystem

Eleven schema models: `AgentDefinition`, `AgentVersion`, `AgentTrigger`, `AgentRun`,
`AgentRunEvent`, `AgentAction`, `AgentAuditEvent`, `AgentBuilderArtifact`,
`AgentConversation` and friends. Two declared eve subagents, `agent_builder` and
`agent_runner`, with independent instructions, independent tool sets and independent
deny-all sandboxes. They inherit nothing from the root agent.

The permission model is the interesting part:

- **Scope is explicit.** A version chooses `SELECTED` or `WORKSPACE` record scope. Empty
  never means all.
- **Connections are executable permissions.** Only `google:gmail` and `google:calendar` are
  accepted, only when connected, and the runner cannot query the synced tables unless the
  deployed manifest names that source.
- **Actions are structured permissions.** `crm.activity.create` separately names `NOTE`,
  `TASK`, or both. Runtime enforcement never infers a grant from the action's prose.
- **Every action is ledgered before execution** in `AgentAction`, keyed by eve's call id
  for replay safety, with an `idempotencyKey` unique index.
- **Deployment is the human approval boundary.** Saving produces a private READY version and
  never deploys it. A human's Deploy action pins that immutable version.
- **Cancelling is a row, not a signal.** `agents.cancelRun` settles the run in one
  transaction, then pokes the agent. The row is what stops the work.

`AgentRun` tracks `modelId`, `inputTokens`, `outputTokens` and `costUsd` per run.

**Classification: DEFER, do not remove.** This is a large, capable, well-guarded subsystem
that we will eventually want for exactly the "small team operating with agents" goal. It is
not V1. Nothing forces us to use it and it costs nothing sitting idle. Revisit at V2.

## D.7 The agent panel and bridge

Every contact, company and deal has an Agent tab. Conversations are durable
(`AgentConversation` holds the eve session id and cursor, `AgentEvent` holds the
transcript). The record travels in a signed token, never in the message body.
`AGENT_BRIDGE_SECRET` unset means the tab reports "not configured" and the agent carries on
with its own schedule.

**Classification: KEEP.**

---

# E. Existing integrations

| Integration | Status | Direction | Notes |
| --- | --- | --- | --- |
| **Google (Gmail + Calendar)** | Built | **Read only** | `gmail.readonly`, `calendar.readonly`. Also the sign-in method. Forward-only sync from a `historyId`. Revoke posts to Google's revoke endpoint. |
| **Microsoft (Outlook)** | Built | **Read only** | `Mail.Read` delegated Graph permission. No calendar. Cursor is last `receivedDateTime` with a one second overlap. No revocation endpoint exists at Microsoft. |
| **Slack** | Built | Read and **write** | Two grants: a bot token on `Account`, a user token on `SlackWorkspaceGrant` keyed by team. Bot self-joins public channels, only a user token can invite it to private ones. Agents can post messages. |
| **Context.dev** | Built | Read | Company brand data (logo, colours, industry, real name behind a domain) and LinkedIn profile reads. **Key lives in `AppSetting.contextDevApiKey`, a database row, not an env var**, and onboarding asks for it. Metered: a brand lookup is 10 credits, a person enrich is 20. |
| **Perplexity** | Built | Read | Open web search with citations. `PERPLEXITY_API_KEY`. Optional. |
| **GitHub** | Built | Read | Raises the rate limit for matching contacts to GitHub profiles. Any scopeless classic token. |
| **Vercel Blob** | Built | Write | Every logo and profile picture is copied to our own storage, keyed by a hash of the bytes. Without the token, photographs are not stored at all. |
| **Vercel AI Gateway** | Built | Read | The only model path. OIDC on Vercel. |
| **Redis / Upstash** | Optional | | Shared cache. Without it, per-instance in-memory. Recommended once tracking is on. |
| **PostHog** | Built | **Write, outbound to upstream** | See C.11. Disable. |
| **Clay** | **Not present** | | Nothing. |
| **Any email sending** | **Not present** | | Nothing. |
| **Any CRM import** | **Not present** | | `RecordSource.IMPORT` exists as an enum value with no importer behind it. |

## E.1 Webhooks

**There are no inbound webhooks in this repository.** No signature verification helper, no
webhook receiver, no event queue endpoint. The internal cron routes are bearer-token
guarded POST endpoints, which is a different thing.

For Clay this means: either we build a webhook receiver, or Clay writes through the
existing authenticated REST bridge with an API key. **The second is better** and is
discussed in section J.

## E.2 API keys

Better Auth's `apiKey` plugin, configured in `packages/auth/src/auth.ts:236` with
`enableSessionForAPIKeys: true`, a 32 byte default key length, a required name and an
expiry window. Managed at `/settings/api-keys`. A key presented in the API key header
resolves to a full session, so **an API key currently has the same authority as the user it
belongs to.** `SessionOnlyMiddleware` exists to explicitly refuse API keys on sensitive
routers (it is applied to the api-keys router itself, so a key cannot mint another key).

**Classification: ADAPT.** This is our Clay ingress, but "an API key equals a full user
session" is too much authority for an enrichment vendor. See section J.

---

# F. Security assessment

## F.1 The authorisation model, in full

`ALLOWED_SIGN_IN` is a comma separated list of email domains and individual addresses
(`packages/auth/src/workspace.ts`). It is checked in
`databaseHooks.user.create.before`. **An unset value means nobody can sign in**, which is
the safe direction to fail, and the API refuses to boot without it
(`apps/api/src/config/env.validation.ts`). Subdomains count, so `acme.com` admits
`you@mail.acme.com`.

Beyond that there is: signed in or not (`AuthMiddleware`), and workspace admin or not
(`isWorkspaceAdmin`, gating rename, role change, currency, connections, tracking, SSO).

**There is no record-level permission of any kind.** Every signed-in user sees every
company, contact, deal, email body and calendar event. For a founder-led team this is
correct and simple. It is worth stating explicitly because it will not scale to a team that
includes contractors or regional partners.

**Classification: KEEP for V1.** Revisit when the first non-founder joins.

## F.2 What is well done

- **The agent bridge proxy is an enforcement point.** The agent never receives a session
  cookie. `AGENT_BRIDGE_SECRET` unset refuses rather than opens.
- **Deny-all sandbox egress set on the backend factory**, not per session.
- **The sandbox never receives `DATABASE_URL`.**
- **`safe-fetch` is a real SSRF guard** covering IPv4, IPv6, mapped addresses, link-local,
  CGNAT, redirects and timeouts.
- **`helmet` is loaded** in the API.
- **Better Auth rate limiting is on**, backed by the database.
- **`next.config.ts` allow-lists only our own Blob host for image optimisation**, because a
  wildcard makes the app an open image proxy. A mirrored SVG is still refused.
- **Logging rules are strict**: never log headers, query strings or bodies. Agent tool
  arguments print outside production only.
- **Purge is transactional** and recomputes activity stamps inside the transaction.
- **The test suite refuses to run without a separate `TEST_DATABASE_URL` whose database name
  ends in `_test`**, because the integration tests delete the organization row and every
  member. The pre-push hook runs them. This guard is the only thing standing between a
  `git push` and a wiped database.

## F.3 What needs attention for AI See You

1. **`supabase-production` MCP server is attached to this development environment with
   `execute_sql`.** This is not a repository finding, it is an environment finding, and it
   is the most serious one in this document. Section Q.
2. **Telemetry is on by default and posts to a third party.** Section C.11.
3. **An API key equals a full user session.** Acceptable for our own scripts, wrong for
   Clay. Section J.
4. **No audit log of human reads.** `AgentAuditEvent` covers agent actions well. There is no
   equivalent for a person opening a record. For GDPR accountability over EU hotel
   executives' data this is a gap, though a defensible one at our scale.
5. **No encryption at rest for OAuth tokens in the `account` table.** `accessToken` and
   `refreshToken` are plain columns. Anyone with a database connection can read every rep's
   Gmail refresh token. Supabase encrypts the volume, which is not the same thing.
   **Classification: DEFER, with eyes open.** Upstream accepted this; so can we at one user.
6. **`Bytes` attachments stored in Postgres.** `AgentConversationAttachment.content` is a
   `Bytes` column. Large attachments in rows will bloat the database. Watch it.
7. **The Slack connect guard is at the OAuth endpoint, not the UI**, which is correct, but
   note that connecting Slack **replaces** the workspace's Slack for everyone.

## F.4 Licence and fork obligations

Upstream is **MIT** (`LICENSE`, copyright 2026 Comp AI). The fork inherits it.

Our obligations are minimal and entirely satisfiable:

- **Retain the copyright notice and the licence text** in all copies or substantial
  portions. Keep `LICENSE` in the repository. Do not delete or rewrite the Comp AI
  copyright line. Adding our own copyright line beneath it is correct.
- **No copyleft.** We may keep the fork private, modify it freely, and never publish our
  changes.
- **No attribution requirement in the UI.** We may remove the "Powered by Context" badge,
  the upstream README, the landing page and the GitHub star badge. The README's marketing
  content is upstream's, not a licence term.
- **No patent grant, no warranty.** MIT gives neither. This is worth knowing if the CRM
  ever becomes a product we sell rather than software we run.

Two practical points that are not licence obligations but are consequences of forking:

- **`IS_MARKETING` must stay unset.** It serves upstream's marketing landing page at `/`.
  Unset, a stranger at the root is redirected to `/sign-in`.
- **Upstream merge burden.** The fork currently has zero divergence. Every AI See You commit
  makes `git merge upstream/release` harder. Section P.

**Classification: KEEP the licence file. REMOVE upstream branding.**

---

# G. Supabase compatibility assessment

You created a dedicated Supabase project in Sydney on Micro compute and explicitly asked me
not to assume that means we should use it. Here is the honest answer.

## G.1 What the application actually requires of its database

Read from the code, not from the README:

| Requirement | Evidence | Supabase? |
| --- | --- | --- |
| Postgres, any recent version | `datasource db { provider = "postgresql" }`, local dev is Postgres 17 | Yes, Supabase is Postgres 17 |
| No extensions | Zero `CREATE EXTENSION` across all 57 migrations | Yes |
| Partial unique indexes | `partialIndexes` preview feature, used on `company.domain` and `contact.email` | Yes, standard Postgres |
| `SELECT ... FOR UPDATE SKIP LOCKED` | `apps/agent/agent/lib/tasks.ts:44` | Yes, and it works under transaction pooling because it is inside a transaction |
| `NUMERIC` with high precision | `Decimal(24,4)`, `Decimal(20,10)` for FX | Yes |
| `JSONB` and `BYTEA` | `Json` and `Bytes` columns throughout | Yes |
| A direct, unpooled connection for migrations | `apps/api/scripts/build-func.mjs:190` | Yes, Supabase provides both |
| Case-insensitive `LIKE` search | `contains` with `mode: "insensitive"`, no full text index | Yes, and this is a scaling note, not a compatibility one |

**Conclusion: there is no technical obstacle. The application is written against plain
Postgres and Supabase is plain Postgres.**

## G.2 What would actually have to change

Three things. That is the whole list.

1. **`DATABASE_URL` points at the Supavisor pooler** (port 6543, transaction mode) with
   `?pgbouncer=true` appended. Prisma's `@prisma/adapter-pg` uses prepared statements by
   default, and transaction-mode pooling does not preserve them across statements. This
   parameter is what disables them. Getting this wrong produces intermittent
   "prepared statement already exists" errors that look like a load problem.
2. **`DIRECT_DATABASE_URL` points at the direct connection** (port 5432). The build script
   already reads this variable and falls back through `POSTGRES_URL_NON_POOLING` and
   `DATABASE_URL_UNPOOLED`. `prisma migrate deploy` needs it; DDL over a transaction pooler
   is unreliable.
3. **Add both to Turbo's `globalPassThroughEnv`.** `turbo.json:7` already lists
   `DATABASE_URL_UNPOOLED`. Turbo runs in strict env mode; an undeclared variable is
   silently absent.

**Nothing else. No code change, no schema change, no ORM change.**

## G.3 Should Prisma stay?

**Yes. KEEP, without qualification.**

Prisma is not a detail here, it is the spine. 57 migrations, a generated client that the
tRPC layer's types flow from, `prisma migrate diff --exit-code` drift detection in the
build, and a schema that three separate deployments share. Replacing it with Drizzle or
raw SQL or the Supabase client means rewriting every service in the API, every tool in the
agent, and losing the type safety that runs from the Prisma row to the table cell.

There is no benefit on offer that would justify it.

## G.4 Should Supabase Auth be used?

**No. REPLACE nothing. KEEP Better Auth.** This is the clearest call in this section.

Better Auth is not just "the login page" in this codebase. It owns:

- The `account` table, where Google and Microsoft **OAuth refresh tokens** live. The
  mailbox sync reads those tokens to fetch mail (`MailboxTokenService`). Moving auth means
  rebuilding the token storage and refresh path that the entire email and calendar
  integration depends on.
- The **SSO plugin**, so an admin can add an OIDC provider from a settings page without a
  redeploy.
- The **API key plugin**, which is our Clay ingress.
- The **organization plugin**, which holds the workspace name, website, onboarded state
  and member roles.
- The `ALLOWED_SIGN_IN` gate, in a `databaseHooks.user.create.before` hook.
- Slack OAuth via the generic OAuth plugin, including a `hooks.before` guard that refuses a
  connect attempt **before the code is exchanged**.

Supabase Auth offers none of this and would require reimplementing all of it. It also
introduces a second identity system into an application that already has one working
correctly. The migration cost is measured in weeks and the benefit is zero.

**One consequence to be explicit about:** because we are not using Supabase Auth, there is
no `auth.uid()` and therefore **row level security has no principal to reason about**. This
is fine, because Prisma connects as a privileged role and the application enforces
authorisation in `AuthMiddleware`. But it means the next point is not optional.

## G.5 The Data API is a live risk and must be turned off

Supabase exposes PostgREST over your tables at `https://<ref>.supabase.co/rest/v1/` using
the anon and publishable keys. **This application has no row level security on any table,
because it has never needed any.** If the Data API is enabled and the anon key leaks, or is
embedded in a front end by a future integration, **every contact, every email body, every
deal amount and every OAuth refresh token is readable by anyone with the URL.**

**Action, before a single row is written:** disable the Data API for this project, or
restrict its exposed schemas to none. Do not rely on remembering not to use it. This is the
single highest-severity item in the Supabase assessment.

**Classification: REMOVE (disable the feature).**

## G.6 Realtime, Edge Functions, Storage, Vector

| Feature | Verdict | Reasoning |
| --- | --- | --- |
| **Realtime** | **DEFER, probably never** | The app is tRPC plus TanStack Query. Enrichment freshness is already solved by `refetchInterval` while a record is `PENDING` or `RUNNING`, documented in `docs/api.md`. Realtime needs a browser-side Supabase client with an anon key and RLS to be safe, which is precisely what G.5 says to avoid. It would add a second data path to an application with one good one. |
| **Edge Functions** | **REMOVE from consideration** | Compute already exists in two places: Vercel Functions for the API and the eve agent runtime. A third runtime with a separate deploy pipeline, a separate secret store and a separate log stream, to run code that could be a NestJS controller, is complexity with no payoff. |
| **Storage** | **DEFER** | Vercel Blob is already wired into `@crm/db/blob` with content-hashed keys and is the only image path. Swapping it is a real refactor for no gain. If we later want assets colocated with data, revisit. |
| **pgvector** | **DEFER, but genuinely interesting later** | Semantic search over contact briefs, hotel descriptions and Production's recommendation intelligence is a plausible future. It is one `CREATE EXTENSION` away whenever we want it. Not V1. |
| **Branching** | **ADAPT, useful** | Supabase database branches are a good fit for testing a migration against production-shaped data. Worth using once we have real data. |
| **Point in time recovery** | **Worth paying for** | Micro compute does not include PITR on the free tier. A CRM is a system of record for a commercial relationship. Daily backups plus PITR is the correct insurance and it is cheap. Section Q. |

## G.7 Does moving to Supabase introduce unnecessary complexity?

**Compared to what?** The repository has no incumbent database. Upstream deploys to Neon.
There is no migration cost because there is nothing to migrate. The choice is Supabase
versus Neon versus Vercel Marketplace Postgres versus self-managed.

Honest comparison:

| | Supabase | Neon (upstream's choice) |
| --- | --- | --- |
| Postgres compatibility | Identical for our purposes | Identical |
| Pooler | Supavisor, needs `?pgbouncer=true` | PgBouncer, same caveat |
| Branching | Yes | Yes, and slightly more mature for this |
| Sydney region | Yes | Yes |
| Scale to zero | No, Micro is always on | Yes, which upstream relies on |
| Surface area we do not want | Auth, Realtime, Edge Functions, **Data API** | Almost none |
| Your existing operational familiarity | **You already run two Supabase projects** | New |

**Recommendation: use the Supabase project, as managed Postgres only.**

The deciding argument is not technical, because technically it is a tie. It is operational.
You are a solo founder. You already understand the Supabase console, its backup UI, its SQL
editor and its connection string layout. Running your third database on a platform you know
is worth more than Neon's marginally better branching story. The extra surface area
(Auth, Realtime, Edge Functions, Data API) is a genuine cost, but it is a cost you pay once
by turning things off, not continuously.

**Do not adopt Supabase as a platform. Adopt it as a Postgres host.** Every time someone
suggests using a Supabase feature, the question to ask is: does this application already
have a working answer to that problem? So far the answer has been yes every time.

**One sizing note.** Micro is 1 GB RAM and roughly 60 direct connections. Three deployments
each holding a Prisma pool, on serverless functions that scale, will exhaust direct
connections. **Use the pooler for `DATABASE_URL` and this is a non-issue.** Do not point the
application at port 5432.

**One latency note.** The Supabase project is in Sydney. **Deploy the Vercel functions to
`syd1`.** Prisma is chatty, and a list view issuing a dozen queries across a Pacific
round trip is the difference between a fast CRM and a slow one. This matters more than any
other performance decision we will make this year.

---

# H. AI See You target architecture

## H.1 The principle, restated as a schema rule

> Production says what a travel business **is**. CRM says what our commercial relationship
> with that business **is**.

The schema rule that follows: **the CRM stores no attribute that Production is
authoritative for, except as a cached display copy that is clearly marked, timestamped and
never joined for an authoritative decision.** Star rating, room count, geolocation,
recommendation scores and property descriptions belong in Production. The CRM stores the
identifier and the relationship.

## H.2 Build on `Company`, do not replace it

I considered three options.

**Option A: a new `BusinessEntity` model, retire `Company`.** Conceptually cleanest. Touches
every router, service, agent tool, UI table, seed, test and migration. Weeks of work,
enormous merge conflict surface against upstream, and it produces a table with a better
name and the same columns. **Rejected.**

**Option B: keep `Company` flat, express everything with custom fields.** Zero migrations.
Also cannot express a many to many contact assignment or a typed relationship edge, which
are the two things we actually need. **Rejected.**

**Option C: keep `Company` as the physical table, add four structures beside it.**
Additive migrations only, no column removed, no existing query broken, upstream merges stay
tractable. Relabel Company as "Business" in the UI. **Recommended.**

## H.3 The proposed model

Presented as a design, not as code. Nothing below has been implemented.

### Vertical

```
Vertical { id, key, label, position, archivedAt }
```

Seeded: `hotel`, `cruise`, `tour`, `destination`. A `Company` gains `verticalId`.

**Why a table and not an enum:** adding Cruise or Tour Operator must not require a
migration and a redeploy. The inherited codebase already prefers rows over environment
variables for the same reason (the Context key, the agent model, the reporting currency).

### Business entity type

`Company` gains `entityType`, a Prisma enum:

```
HOTEL | HOTEL_GROUP | HOTEL_BRAND | MANAGEMENT_COMPANY | OWNERSHIP_GROUP |
DESTINATION_ORGANISATION | CRUISE_LINE | CRUISE_SHIP | TOUR_OPERATOR | OTHER
```

**A hotel group and a management company are different rows, not a flag on one row.** Accor
the brand owner, Accor the management company and a specific Sofitel property are three
entities with three different commercial relationships to us. This is exactly the case the
inherited flat model cannot represent.

`CRUISE_SHIP` sits in the same table as `HOTEL` deliberately. A ship is a sellable unit with
a name, a capacity, an operator and a set of destinations. It behaves like a property. Do
not build a separate ship model.

### EntityRelationship, the graph

```
EntityRelationship {
  id
  fromCompanyId    -> Company
  toCompanyId      -> Company
  type             RelationshipType
  validFrom        DateTime?
  validTo          DateTime?
  source           RecordSource
  evidence         Json?
  note             String?
  createdAt, updatedAt
  @@unique([fromCompanyId, toCompanyId, type], where: { validTo: null })
  @@index([toCompanyId, type])
}

enum RelationshipType {
  BELONGS_TO      // property -> group
  BRAND_OF        // property -> brand
  MANAGED_BY      // property -> management company
  OWNED_BY        // property -> ownership group
  OPERATED_BY     // ship -> cruise line
  LOCATED_IN      // property -> destination organisation
}
```

Three deliberate choices:

- **Directed and typed.** `A managed_by B` is not `B managed_by A`.
- **Temporal.** `validFrom` and `validTo`, because a hotel changing management company is a
  commercially important event we must be able to see, not overwrite. The unique index is
  partial on `validTo IS NULL` so only one relationship of a given type can be current.
- **Not a tree.** A single property is routinely branded by one company, managed by a
  second, owned by a third and located in a fourth destination organisation's territory.
  Any `parentId` column is wrong within a month. A `parentId` shortcut is the most common
  way this model gets built badly and it should be refused explicitly.

`contact_responsible_for` is deliberately **not** in this enum. It is a contact-to-entity
edge, not an entity-to-entity edge, and belongs in `ContactAssignment` below.

### ContactAssignment, the thing that unblocks group contacts

```
ContactAssignment {
  id
  contactId    -> Contact
  companyId    -> Company
  roleType     ContactRoleType
  title        String?          // as stated at this entity, may differ from Contact.title
  scope        AssignmentScope  // EMPLOYER | RESPONSIBLE_FOR
  isPrimary    Boolean          // exactly one true per contact, the employer
  validFrom, validTo
  source       RecordSource
  evidence     Json?
  @@unique([contactId, companyId, scope], where: { validTo: null })
  @@index([companyId, roleType])
  @@index([contactId, isPrimary])
}

enum AssignmentScope { EMPLOYER, RESPONSIBLE_FOR }

enum ContactRoleType {
  GENERAL_MANAGER | REVENUE | DISTRIBUTION | COMMERCIAL | MARKETING |
  DIGITAL | OWNER | EXECUTIVE | PROCUREMENT | OTHER
}
```

**This is the answer to "a senior group contact may be responsible for hundreds of
properties".** The Group Director of Distribution at Accor has one row with
`scope = EMPLOYER, isPrimary = true` pointing at the Accor management company entity, and
180 rows with `scope = RESPONSIBLE_FOR` pointing at properties. Queries in both directions
are index-served.

**Compatibility rule that keeps the whole plan cheap:** `Contact.companyId` is retained and
kept in sync with the single `isPrimary` employer assignment. Every inherited query, every
agent tool, every UI component and every mailbox matcher keeps working unchanged. The new
table is purely additive. This one decision is what turns a rewrite into a migration.

**Bulk assignment is a first-class need, not an afterthought.** 180 rows must be creatable
from one action ("this contact covers all Accor properties in APAC"), and it must be
re-runnable when the group adds a property. Expect a `assignmentRule` concept eventually. Do
not build it in V1; do design the table so it can be added.

### ExternalRef, the only link to Production and Clay

```
ExternalRef {
  id
  recordType   ExternalRecordType   // COMPANY | CONTACT
  recordId     String
  system       ExternalSystem       // PRODUCTION | CLAY | LINKEDIN | CONTEXT_DEV
  externalId   String
  externalUrl  String?
  matchMethod  String               // how the link was established
  matchedBy    MatchActor           // HUMAN | AGENT | IMPORT
  confirmedAt  DateTime?            // null means proposed, not confirmed
  lastSeenAt   DateTime?
  createdAt, updatedAt
  @@unique([system, recordType, externalId])
  @@unique([system, recordType, recordId])
  @@index([recordType, recordId])
}
```

**Its own table, not a column and never a custom field.** Reasons:

- A record may carry references to several systems.
- The unique constraints enforce a genuine 1:1 in both directions per system, which is what
  makes the link trustworthy. Two CRM companies cannot both claim the same Production
  property, and one CRM company cannot claim two.
- `confirmedAt` distinguishes an agent's proposal from a human's confirmation. **An
  unconfirmed match must never be treated as canonical.** This mirrors the inherited
  `ContactFact` PROPOSED / APPLIED distinction, which is a pattern this codebase already
  understands.
- `matchMethod` and `matchedBy` mean a wrong link can be found and explained later.

### Opportunity

Rename `Deal` in the UI to Opportunity, keep the table. Two changes:

- **Replace the `DealStage` enum** with travel-appropriate stages. The inherited stages
  (`DEMO_BOOKED`, `DECISION_MAKER_BOUGHT_IN`) are B2B SaaS. Proposed:
  `IDENTIFIED`, `CONTACTED`, `ENGAGED`, `EVALUATING`, `PROPOSAL_SENT`, `IN_CONTRACT`,
  `LIVE`, `CLOSED_LOST`, `DORMANT`. This is one migration plus `packages/db/src/deal-stage.ts`.
- **Add `OpportunityEntity`**, a join, so a group-level opportunity can cover many
  properties, keeping `Deal.companyId` as the primary counterparty for compatibility. A
  master agreement with a hotel group that unlocks 180 properties is a single opportunity
  with 180 covered entities, and revenue attribution depends on being able to say so.

### Activity, Campaign, Outreach, Customer

- **Activity: KEEP the table.** Add `OUTREACH` and `REPLY` to `ActivityType`, and add an
  optional `outreachMessageId`. Everything else already fits.
- **Campaign, Outreach: new, section K.** Do not model these until outreach exists.
- **Customer: not a table.** A customer is an entity whose `Lifecycle stage` field is
  Customer and which has a `CLOSED_WON` or `LIVE` opportunity. Creating a `Customer` model
  duplicates state that already exists in two places and guarantees they disagree. Use the
  existing `FieldDefinition` machinery.

## H.4 What this looks like in migrations

| # | Migration | Risk |
| --- | --- | --- |
| 1 | `Vertical` table, `Company.verticalId`, `Company.entityType` (default `OTHER`), seed the four verticals | Low, purely additive |
| 2 | **Drop the global unique on `Company.domain`**, replace with a non-unique index; add a `duplicate candidate` review view | **Medium, the one that needs care** |
| 3 | `EntityRelationship` + `RelationshipType` | Low |
| 4 | `ContactAssignment` + enums, backfill one `EMPLOYER` row per existing `Contact.companyId` | Low |
| 5 | `ExternalRef` + enums | Low |
| 6 | `OpportunityEntity`, replace `DealStage` values | Medium, enum change with data |

**Migration 2 is the one to think hardest about.** Dropping the domain uniqueness removes
the guard that stops the mailbox sync creating duplicate companies. It must land together
with a change to `CompanyDirectoryService.companyForEmail`
(`apps/api/src/companies/company-directory.service.ts:13`), which currently auto-creates a
company from any unrecognised sending domain. For travel that behaviour is actively harmful:
the first email from a Sofitel GM at an `accor.com` address creates a company literally named
"accor.com" and files the contact there.

**Recommended replacement behaviour:** an unrecognised domain creates a **pending review
row**, not a company. The agent proposes which existing entity it belongs to, or proposes
creating one, and a human confirms. This is the same PROPOSED / APPLIED shape as
`ContactFact` and fits the codebase's existing grain.

---

# I. Production integration boundary

## I.1 The rule

**CRM reads Production. CRM never writes Production. There is no exception and no flag.**

Everything below exists to make that rule structurally true rather than a thing we remember.

## I.2 Identifiers

- Production's own primary key for a business is the canonical identifier. **The CRM does
  not mint travel business ids and does not attempt to be a registry.**
- The link lives in exactly one place: `ExternalRef` with `system = PRODUCTION`.
- **Domain is a matching hint, never an identifier.** Fifty properties share `accor.com`.
- The CRM's `Company.id` is a cuid that is meaningless outside the CRM. **Do not export it
  to Production, do not ask Production to store it.** The relationship is one directional by
  construction: only the CRM knows about the link, so only the CRM can break it.

## I.3 Read mechanism, in order of preference

**Preferred: a narrow, read-only HTTP endpoint on Production**, owned by Production,
returning exactly the fields the CRM is allowed to display, with a service token the CRM
holds. Something like `GET /internal/crm/businesses/{id}` and
`GET /internal/crm/businesses?updatedSince=...`.

Why this and not a database connection:

- The contract is explicit and versioned. A Production schema change breaks a documented
  endpoint, loudly, rather than silently changing what the CRM shows.
- The permission is a token scope, not a Postgres grant that someone can widen.
- **It is structurally read-only.** There is no write verb to accidentally call.
- It is testable and mockable without a database.

**Acceptable fallback: a dedicated read-only Postgres role in Production Supabase**
(`GRANT SELECT` on named views only, never on tables, `NOSUPERUSER`, `NOCREATEDB`) exposed
through a small set of purpose-built views. Slightly cheaper to build, meaningfully riskier,
because the safety is a grant someone can change and there is no audit of what the CRM read.

**Rejected: sharing `DATABASE_URL` or a Supabase service role key with the CRM.** A service
role key bypasses everything. This is exactly how "CRM must not become an uncontrolled
writer into Production" fails in practice.

**Also rejected: cross-database queries, foreign data wrappers, or putting the CRM schema
inside the Production project.** Two Supabase projects means two blast radii. That is the
point of having created a separate one.

## I.4 Caching

**Yes, cache, and mark it clearly.**

```
ProductionSnapshot {
  productionId   String @id
  entityKind     String       // property | group | destination | ...
  name           String
  country, city, region
  payload        Json         // the full read, for display only
  fetchedAt      DateTime
  staleAfter     DateTime
}
```

Rules:

- **Display only.** Never joined for an authoritative decision, never filtered on for a
  commercial report, never used as an input to opportunity value.
- **Every UI surface that shows it says where it came from and when**, for example
  "From AI See You Production, 3 hours ago". This is the discipline that stops the CRM
  quietly becoming a second, worse source of truth.
- **Refreshed by an `AgentTask` of a new kind, `production-refresh`, with a `dueAt`.** The
  inherited queue handles this with no new machinery.
- Cheap and correct: refresh on record open if stale, plus a nightly sweep of entities with
  an active opportunity.

## I.5 Write boundary

**Zero writes. Not now, not behind a feature flag, not for a "quick fix".**

The CRM will discover things Production should know: a hotel changed management company, a
group rebranded, a property closed. Handling this correctly:

1. The discovery is recorded in the CRM as a `ContactFact`-shaped observation with evidence
   (the existing ledger pattern generalises here).
2. It appears in a **Production feedback queue** in the CRM UI: "these 12 CRM observations
   contradict Production".
3. A human reviews and exports. The export is a file, a ticket, or a pull request against
   Production's own data pipeline. **A human is in the loop and Production's own process
   applies the change.**

The moment there is an automated write path, the architectural principle is dead, because
the next person to need one will use it.

## I.6 Synchronisation rules

| Question | Answer |
| --- | --- |
| Direction | Production to CRM only. |
| Trigger | On demand (record opened, stale) plus a nightly sweep of entities with an active opportunity. Not a full mirror. |
| What is copied | Identifier, name, kind, country, city, region, and a display payload. **Not** recommendation intelligence, **not** scores, **not** full descriptions. |
| What is never copied | Anything the CRM would then be tempted to filter or report on. |
| Conflict | Production wins, always, for what a business is. The CRM never overwrites its cache with its own opinion. |
| Deletion | A Production id that stops resolving marks the `ExternalRef` stale and raises a review item. **It never deletes the CRM record**, because our commercial history with that business is ours and survives Production changing its mind. |
| Volume | Never mirror the full Production dataset. If someone proposes a nightly full sync, that is the signal the boundary is being eroded. |

## I.7 The immediate environment risk

This session has two Supabase MCP servers attached: `supabase` (the new CRM project) and
`supabase-production`. The production one exposes `execute_sql`. **Any agent session in this
workspace, including a future one with a vague instruction, can write to Production with a
single tool call.**

No amount of architecture in this document mitigates that. **Action: remove
`supabase-production` from this project's MCP configuration, or replace its credential with
a read-only one, before the first implementation session.**

---

# J. Clay integration design

## J.1 The rule

**Clay enriches. Clay does not decide. Clay is never a source of truth.**

The inherited codebase already has a mechanism for exactly this, and it is the best thing
in the repository: the evidence ledger. Clay should flow through it, not around it.

## J.2 Where Clay code lives

**In `apps/agent`, never in `apps/api`.** This is the repository's load-bearing rule
(`docs/api.md`): intelligence never lives in the API, Nest reports that something happened,
the agent decides what it means. A Clay client in a NestJS service is the first crack in
the architecture that makes the fork worth keeping.

## J.3 The flow, mapped to the desired one

| Your step | Mechanism |
| --- | --- |
| AI See You business | `Company` with `ExternalRef(system: PRODUCTION)` |
| CRM commercial target | Lifecycle stage field set, or an `Opportunity` exists |
| Identify missing contacts | A **coverage rule** per entity type: a hotel needs a GM, a Revenue lead and a Distribution lead. A `contact-coverage` `AgentTask` computes the gap. |
| Clay enrichment | An `EnrichmentRequest` row, then an agent-side Clay call |
| Receive candidates | Clay POSTs to a dedicated intake endpoint, landing in `EnrichmentCandidate` |
| Validate and deduplicate | Agent-side, against email, LinkedIn URL and name-plus-employer |
| Associate with canonical business | `ContactAssignment` rows, `EMPLOYER` and/or `RESPONSIBLE_FOR` |
| Outreach-ready record | Coverage satisfied, contact not suppressed, has a deliverable address |

## J.4 Ingress: a dedicated intake endpoint, not the generic REST bridge

The inherited `/rest/*` bridge plus a Better Auth API key would work on day one. **It is the
wrong door.**

An API key currently resolves to a full user session, so a Clay key could archive a company,
purge a contact or read every email body. And writing straight into `Contact` bypasses the
evidence ledger, which is the entire quality control mechanism.

**Proposed:**

```
POST /intake/enrichment/candidates
  Authorization: Bearer <scoped intake key>
  { requestId, candidates: [ { ...person fields, evidence: {...}, providerRecordId } ] }
```

- **A separate credential type with exactly one permission: append to
  `EnrichmentCandidate`.** Cannot read, cannot update, cannot delete.
- **HMAC signature verification** on the raw body plus a timestamp window, in addition to the
  bearer token. The repository has no webhook verification helper today; this would be the
  first, and it should be written once and shared.
- **Idempotent by `providerRecordId`.** The inherited `lockIdempotencyKey`
  (`packages/db/src/idempotency.ts`) is the existing pattern.
- **Writes a row and returns 202. It decides nothing.** An `AgentTask` of kind
  `enrichment-candidates` is queued, and the agent processes it. This is exactly the
  inherited "Nest reports, the agent decides" shape.

```
EnrichmentCandidate {
  id, requestId, providerRecordId, provider,
  targetCompanyId, targetContactId?,
  payload Json, evidence Json,
  status  // RECEIVED | MATCHED | MERGED | REJECTED | DUPLICATE
  rejectReason String?
  receivedAt, processedAt
  @@unique([provider, providerRecordId])
}
```

## J.5 Deduplication

Order matters, strongest first:

1. **Email exact match**, normalised lower case. `Contact.email` is already uniquely indexed
   over active rows, so this is free.
2. **LinkedIn URL match**, canonicalised. The inherited `canonicalValue`
   (`apps/agent/agent/lib/facts.ts`) already drops scheme, `www.`, trailing slash and query,
   and reads `twitter.com` as `x.com`. Reuse it, do not write a second one.
3. **Name plus employer entity**, requiring the resolved `ContactAssignment` to match.
4. **Anything weaker becomes a proposal for a human**, never an automatic merge.

**Two travel-specific traps to handle explicitly.** Generic addresses
(`gm@hotelname.com`, `reservations@`) are roles, not people, and the inherited
`isAutomatedAddress` already catches the common shapes. And one human genuinely holds the
same title at four properties, which is a real assignment fan-out, not a duplicate.

## J.6 Evidence and confidence

**Clay's confidence score is discarded at the boundary.** The inherited design refuses
self-graded confidence and prices observations instead. Clay's outputs become facts with new
observation kinds in `apps/agent/agent/lib/evidence.ts`:

| New method | Suggested weighting |
| --- | --- |
| `clay.waterfall-email` | Secondary. Never primary. |
| `clay.linkedin-profile` | Secondary, promoted to primary only when the profile URL is subsequently read directly. |
| `clay.company-website` | Secondary. |

**No Clay observation should be primary on its own.** The existing ledger requires at least
one primary source before writing to a record. That means a Clay-discovered contact arrives
`PROBABLE`, fills a blank field automatically (which is right, an empty field costs nothing),
and requires a human decision to overwrite an existing value (which is also right). **This
behaviour is already built and tested.** We are adding vocabulary, not mechanism.

Provenance is preserved in `ContactFact.evidence` as JSON: which Clay table, which run,
which waterfall provider, which timestamp.

## J.7 Staleness, employment change and refresh

- `ContactAssignment.validTo` closes an assignment rather than deleting it. Employment
  history is commercially valuable: a GM who moves from one group to another is a warm
  introduction at the new one.
- `tools/record_job_change.ts` already exists and does exactly this.
- **Refresh cadence belongs in `AgentTask.dueAt`, never in a cron.** The inherited rule.
  Proposed: contacts on an active opportunity every 90 days, contacts on a target entity
  every 180 days, everyone else on demand.
- `schedule_recheck` already books its own `dueAt` and its `reason` is shown to the rep.

## J.8 Cost and rate control

Clay bills credits. The inherited budget model is per session
(`apps/agent/agent/lib/focus.ts`) and a unit is one metered vendor call. That is the right
grain but the wrong scope for a spend ceiling.

**Add an `EnrichmentBudget` concept:** a monthly credit ceiling, a per-entity ceiling, and a
per-run ceiling, checked before a request is issued and recorded after. Surface remaining
budget in the UI. An automated commercial operation that can silently spend an unbounded
amount on enrichment is a business risk, not a technical one.

**Bulk enrichment should be queued, never synchronous.** One `EnrichmentRequest` per entity,
each a queue row with a `dueAt`, drained at a controlled rate. The queue already exists.

## J.9 What Clay must never do

- Never write directly to `Contact`, `Company` or `Deal`.
- Never create a `Company`. Business entities come from Production or from a human.
- Never set an `ExternalRef` with `system = PRODUCTION`.
- Never resolve a match a human has rejected.
- Never be called from `apps/api`.

**Classification: build new, do not implement in V1.** Section L.

---

# K. Outreach architecture

## K.1 What we inherited

**Nothing.** Stated precisely, because it is easy to assume otherwise from a CRM:

| Capability | Inherited |
| --- | --- |
| Manual outreach | **No.** Gmail scope is `gmail.readonly`, Outlook is `Mail.Read`. There is no send path anywhere. |
| Automated outreach | No |
| Campaigns | No. `campaign` in this codebase is a UTM parameter on `TrackedVisitor`. |
| Sequences | No. `docs/list-building-roadmap.md` explicitly states sequence status has no source of truth in this CRM. |
| Suppression | **No.** `SuppressedContact` and `SuppressedDomain` are inbox filters and purge tombstones. See C.10. |
| Unsubscribe | No. Zero occurrences in the repository. |
| Bounce handling | No |
| Send limits | No |
| Personalisation | No send, so no |
| **Reply detection** | **Partly, and this is the valuable part.** The mailbox sync ingests inbound and outbound mail into `EmailThread` and `EmailMessage` with `EmailDirection`, keyed on RFC message id, and creates an `EMAIL` activity. A reply to an email we sent from the same mailbox **is already detected and filed.** |
| Reply classification | No, but the agent could do it with a tool and a task kind |
| Meeting booking | Partly. `CalendarEvent` and `CalendarAttendee` are synced read-only, and a `meeting-prep` task kind exists. No booking. |
| Follow-up tasks | **Yes.** `Activity` with `type = TASK`, `dueAt` and `completedAt`. |
| Campaign attribution | Partly, for inbound web traffic only (`TrackedVisitor` first and last touch). Nothing for outbound. |

**The honest summary: we inherited an excellent inbound listener and no outbound speaker.**

## K.2 The one thing to decide before designing anything

**Do we send from the CRM, or does the CRM record sends made elsewhere?**

The temptation is to build a sequencer. I would push back on that for a founder-led
operation, at least initially.

**Recommended for V1 and V2: the CRM is the system of record for outreach, and sends happen
from the founder's own mailbox.** Reasoning:

- Deliverability is a specialist discipline. Domain warming, SPF, DKIM, DMARC alignment,
  reply-rate monitoring and inbox placement are not things to learn while also building a
  CRM. Sending high-value, low-volume outreach to hotel executives from a real, warm,
  human mailbox is both better for reply rates and far lower risk than a cold sending
  infrastructure.
- The reply detection we need **already works** for mail sent from a connected mailbox.
- The volume implied by a founder-led operation targeting hotel groups is low hundreds per
  month, not tens of thousands. That is comfortably a human mailbox.

**What this needs, concretely:** upgrade the Google scope from `gmail.readonly` to include
`gmail.send`, or use `gmail.compose` to create drafts the founder reviews and sends. **The
draft path is safer** and fits an agentic operation well: the agent writes, the human sends,
the reply lands back in the CRM automatically. One scope change, one tool, no sending
infrastructure.

## K.3 The model to build, when the time comes

```
Campaign {
  id, name, verticalId?, objective, status,
  startedAt, endedAt, createdById
}

OutreachSequenceStep {   // deferred
  campaignId, position, channel, delayDays, templateId
}

OutreachMessage {
  id, campaignId?, contactId, companyId?, opportunityId?,
  channel        // EMAIL | LINKEDIN | PHONE
  direction      // OUTBOUND | INBOUND
  status         // DRAFTED | APPROVED | SENT | DELIVERED | BOUNCED | REPLIED | FAILED
  subject, body, personalisationInputs Json,
  emailMessageId?  -> EmailMessage    // the link back to the synced thread
  sentAt, deliveredAt, repliedAt, bouncedAt,
  createdById, approvedById
}

Suppression {
  id, email?, domain?, contactId?, companyId?,
  reason         // UNSUBSCRIBED | BOUNCED_HARD | COMPLAINED | MANUAL | LEGAL
  source, note, createdAt, expiresAt?
  @@unique([email, reason]) where email is not null
}
```

**`Suppression` is a separate table from `SuppressedContact` and this is deliberate.** The
inherited one is cleared when a contact is re-added. An unsubscribe must survive that
forever. Conflating them is a compliance failure waiting to happen.

`OutreachMessage.emailMessageId` is what makes attribution work: the outbound message links
to the synced `EmailMessage`, the reply arrives on the same `EmailThread`, and the chain from
campaign to reply to meeting to opportunity is a join, not a guess.

## K.4 Compliance, which is not optional

We will be emailing hotel executives in Australia, Europe, Asia and the Americas.

- **Australian Spam Act 2003** applies to us as an Australian sender: consent (inferred
  consent from a published business address is available but narrow and conditional),
  clear sender identification, and a functional unsubscribe honoured within 5 working days.
- **GDPR** applies to EU-based contacts. Legitimate interest is a workable lawful basis for
  B2B outreach, but it requires a documented balancing test, a privacy notice at first
  contact, and honouring objection.
- **Every outbound message needs an unsubscribe mechanism and a suppression check before
  send.** Both must be enforced in code, not in a checklist.

**Classification: DEFER the build, but design the suppression check into the send path from
the first message ever sent.** Retrofitting suppression after a thousand sends is how a
sending domain gets burned.

---

# L. Proposed V1

## L.1 The bar

The founder opens the CRM and can answer nine questions. Here is the honest state of each
against the inherited software plus the data model work in section H.

| Question | Answerable? | What it needs |
| --- | --- | --- |
| Who are our target businesses? | **Yes** | Companies list, filtered by Vertical and Lifecycle stage. Both are field work, not new machinery. |
| Who are the right people? | **Yes** | Contacts with `ContactAssignment` and `roleType`, filterable. Needs the new join table. |
| Which contacts are missing? | **Yes** | Coverage rules per entity type, rendered as a gap view. New but small. |
| Who have we contacted? | **Partly** | Inbound and outbound threads are captured if sent from the connected mailbox. Full answer needs `OutreachMessage`. |
| What happened? | **Yes** | Activity timeline exists and is good. |
| Who needs following up? | **Yes** | `Activity` with `type = TASK` and `dueAt`. Exists today. |
| Which companies are opportunities? | **Yes** | `Deal` list by stage. Exists today. |
| Which are customers? | **Yes** | Lifecycle stage field. Exists today. |
| What should I deal with today? | **Yes** | Overdue tasks, replies since yesterday, opportunities with a stale `lastActivityAt`. A dashboard query over existing data. |

**Seven of nine are answerable with the inherited software plus roughly four migrations.**
That is a good position and it argues strongly for keeping the fork.

## L.2 V1 scope

**In:**

1. **Fork hygiene.** Telemetry off, `IS_MARKETING` unset, upstream branding removed, our own
   README, `CLAUDE.md` and `AGENTS.md` updated for our conventions.
2. **Supabase as managed Postgres.** Pooled `DATABASE_URL`, direct `DIRECT_DATABASE_URL`,
   Data API disabled, PITR considered, Vercel functions in `syd1`.
3. **Deploy three apps.** App, API, agent. Google sign-in for the founder,
   `ALLOWED_SIGN_IN` set to the aiseeyou.com domain.
4. **Data model migrations 1 and 3 to 5** from H.4: Vertical, entityType, EntityRelationship,
   ContactAssignment, ExternalRef.
5. **Migration 2 with care:** drop the domain uniqueness and change
   `companyForEmail` to propose rather than auto-create.
6. **Seed the travel field set:** Vertical, Lifecycle stage, Relationship tier, Region,
   Priority. Reuse `FieldDefinition`. Retire the inherited SaaS-flavoured seeds.
7. **A manual, human-confirmed Production link.** `ExternalRef` written from the UI by
   pasting or picking a Production id. **No Production API integration in V1.** This proves
   the boundary works before automating across it.
8. **Import the initial target list.** A one-off script writing entities, relationships and
   external refs from a spreadsheet. `RecordSource.IMPORT` already exists as an enum value.
9. **Turn the existing agent on for company brand enrichment and contact identification.**
   It works today and gives immediate value with no new code.
10. **Two views the founder actually opens:** Today (overdue tasks, new replies, stale
    opportunities) and Coverage (target entities missing a required role).

**Out of V1, explicitly:**

- Clay. Section J is the design; do not build it yet. Get 200 businesses and their known
  contacts in first, so we can measure what Clay actually adds.
- Outreach sending, campaigns, sequences, suppression.
- The Production read API. Manual links first.
- The custom agent builder. It is inherited, it works, it is not needed.
- Website tracking.
- Slack.
- Multi-currency reporting beyond the default.
- Cruise and Tour verticals as data. The **model** supports them from day one, which is the
  point. The data comes later.

## L.3 Why this V1 and not more

The strongest argument for this scope: **the data model is the only thing that is expensive
to change later.** Getting `ContactAssignment`, `EntityRelationship` and `ExternalRef` right
before there are ten thousand rows costs four migrations. Getting them wrong and fixing them
afterwards costs a data migration, a re-import, and a period where the CRM is untrustworthy.

Everything else on the list (Clay, outreach, Production sync) is additive and can be built
against a correct model at any time.

The strongest argument against overbuilding: a founder-led CRM that nobody opens because it
is half-built and confusing is worth less than a spreadsheet. Ten good views beat sixty
half-populated ones.

---

# M. What we should retain

| Item | Where | Class | Why |
| --- | --- | --- | --- |
| Monorepo and three-deployment split | root, `apps/*` | **KEEP** | The agent surviving the browser closing is the whole point. |
| Prisma, the schema, 57 migrations | `packages/db` | **KEEP** | The spine. Type safety runs from the row to the table cell. |
| Better Auth, allow-list, SSO, API keys | `packages/auth` | **KEEP** | Owns the OAuth tokens the mailbox sync depends on. Replacing it is weeks for nothing. |
| tRPC data surface and REST bridge | `apps/api` | **KEEP** | The REST bridge plus OpenAPI is our external integration door. |
| Rule: intelligence never lives in the API | `docs/api.md` | **KEEP** | The rule that keeps this codebase coherent. Clay goes in the agent. |
| Single tenant, singleton workspace | `packages/db/src/workspace.ts` | **KEEP** | Correct for us. Do not add tenancy. |
| `AgentTask` durable work queue | `apps/agent/agent/lib/tasks.ts` | **KEEP** | Postgres-backed leasing with `FOR UPDATE SKIP LOCKED`. Exactly what an automated operation needs. |
| Two-lane dispatch | `apps/agent/agent/schedules/dispatch.ts` | **KEEP** | Cheap work never queues behind model sessions. |
| `ContactFact` evidence ledger | schema 402-465, `lib/evidence.ts`, `lib/facts.ts` | **KEEP** | The best thing in the repository. Clay flows through it. |
| Deny-all sandbox, no `DATABASE_URL` | `agent/sandbox/sandbox.ts` | **KEEP** | Genuinely good security engineering. |
| `safe-fetch` SSRF guard | `packages/db/src/safe-fetch.ts` | **KEEP** | Complete and correct. |
| Agent bridge as an enforcement point | `apps/app/app/eve/v1/[...path]` | **KEEP** | The agent never sees a session cookie. |
| Mailbox sync, one thread writer, RFC-id threading | `apps/api/src/mailbox` | **KEEP** | Cross-provider threading is subtle and it is done right. |
| Activity model including `TASK` | schema 1100-1145 | **KEEP** | Answers "who needs following up" today. |
| `FieldDefinition` / `FieldValue` EAV | `packages/db/src/fields.ts` | **KEEP** | Zero-migration escape hatch for classification. |
| `SavedView` | schema 1085 | **KEEP** | Named, shareable lists. |
| Archive-then-purge with retention | `apps/api/src/archive` | **KEEP** | Correct default for a system of record. |
| Vercel Blob image mirroring | `packages/db/src/blob.ts` | **KEEP** | Hotel logos on someone else's CDN will vanish. |
| Custom agent builder and runner | `apps/agent/agent/subagents/*` | **DEFER** | Large, well-guarded, not V1, costs nothing idle. |
| MIT `LICENSE` file | root | **KEEP** | Licence obligation. |

---

# N. What we should modify

| Item | Class | Change |
| --- | --- | --- |
| `Company` | **ADAPT** | Add `entityType`, `verticalId`. Relabel to Business in the UI. Keep the table. |
| **`Company.domain` unique index** | **REPLACE** | Drop the global uniqueness. Hotel groups share domains. Replace with a non-unique index plus a duplicate review view. |
| **`Contact.companyId`** | **ADAPT** | Keep it, and keep it synced with the primary employer assignment. Add `ContactAssignment` beside it for the many-to-many. This is what keeps the change cheap. |
| `CompanyDirectoryService.companyForEmail` | **REPLACE** | Auto-creating a company from a sending domain is actively harmful for travel. Propose, do not create. |
| `DealStage` enum | **REPLACE** | B2B SaaS stages. Travel partnership stages instead. |
| `Deal` | **ADAPT** | Rename to Opportunity in the UI. Add `OpportunityEntity` for group agreements covering many properties. |
| `ActivityType` enum | **ADAPT** | Add `OUTREACH` and `REPLY` when outreach exists. |
| `RecordSource` enum | **ADAPT** | Add `ENRICHMENT` and `API`. |
| Seeded `FieldDefinition` set | **ADAPT** | Replace SaaS seeds with travel: Vertical, Lifecycle stage, Relationship tier, Region, Priority. |
| `identity-matching.md` skill | **ADAPT** | Add travel rules: shared group domains, role addresses, one person at many properties. |
| Agent read tools | **ADAPT** | Must return relationships and assignments, not just a single company. The "no dead ends" rule demands it. |
| API key authority | **ADAPT** | A scoped intake credential for Clay, not a full user session. |
| `.env` / Vercel environment | **ADAPT** | Pooled and direct database URLs, `CRM_TELEMETRY_DISABLED=1`, `IS_MARKETING` unset, `syd1` region. |
| `README.md`, `CLAUDE.md`, `AGENTS.md` | **ADAPT** | Ours, not upstream's. Keep the good engineering rules, change the ownership. |

---

# O. What we should remove

| Item | Class | Why |
| --- | --- | --- |
| `packages/telemetry` and its cron | **REMOVE** | Reports our operating tempo to Comp AI's PostHog. Disable via `CRM_TELEMETRY_DISABLED=1` day one, strip the package later. |
| `posthog-js` dependency and `components/landing/analytics.tsx` | **REMOVE** | Gated to `trycrm.ai` so it is inert for us, but it is upstream's analytics in our bundle. |
| The marketing landing page, `app/(landing)/page.tsx` | **REMOVE** | Markets upstream's product. Keep `IS_MARKETING` unset until it is deleted. |
| Upstream branding: "Powered by Context" badge, GitHub star badge, product screenshots | **REMOVE** | Not a licence obligation. `docs/images/*`. |
| `CONTRIBUTING.md`, `SECURITY.md`, `.github/workflows/auto-pr.yml`, `pr-title.yml`, `release.yml` | **REMOVE or REPLACE** | Upstream's contribution process, release-please versioning and PR conventions. Keep `ci.yml`. |
| `Invitation` model usage | **REMOVE (already unused)** | Documented as unused. Signing in is the join. |
| Slack integration | **DEFER, then decide** | Well built, and we may want agent notifications. Not V1. Do not connect it. |
| Website tracking subsystem | **DEFER** | Works, not V1, and needs a consent banner before it is switched on for EU visitors. |
| `SuppressedContact` / `SuppressedDomain` as an outreach list | **do not repurpose** | Not a removal, a warning. They are inbox filters. Build a separate `Suppression` model. |

---

# P. Key risks

Ordered by expected damage.

**1. Accidental write to Production. Severity: critical. Likelihood: real today.**
A `supabase-production` MCP server with `execute_sql` is attached to this development
environment. Mitigation: detach it or make its credential read-only, before the first
implementation session. This is the one item on this list that is dangerous right now.

**2. Supabase Data API exposure. Severity: critical. Likelihood: moderate.**
No table has row level security, because the application has never needed any. If PostgREST
is enabled and an anon key leaks or is embedded in a future front end, every contact, email
body, deal amount and OAuth refresh token is readable. Mitigation: disable the Data API on
the CRM project before the first row is written. Section G.5.

**3. Getting the data model wrong. Severity: high. Likelihood: moderate.**
Specifically: adding a `Company.parentId` instead of a relationship table, or putting the
Production id in a custom field instead of `ExternalRef`. Both are the cheap version that
looks fine for two months. Mitigation: sections H.3 and I.2 are explicit about why the cheap
version fails.

**4. Fork drift and upstream merge burden. Severity: medium-high. Likelihood: certain.**
The fork has zero divergence today. Every AI See You commit makes `git merge upstream/release`
harder, and the upstream repository is actively developed. Mitigation: keep changes
**additive and file-local**. New models in new migrations, new tools in new files, new routers
in new modules. Modify inherited files as rarely as possible, and when you must, do it in
small commits with clear messages. Merge upstream monthly rather than yearly. Accept that we
may eventually stop merging entirely, and make that a decision rather than a drift.

**5. The Vercel API build vendoring. Severity: medium. Likelihood: moderate.**
`apps/api/scripts/build-func.mjs` hand-maintains an externals and vendoring list because Nest
declares runtime needs as peer dependencies. Adding a dependency without checking it lands in
`.vercel/output` gives a green build that throws `MODULE_NOT_FOUND` on the first production
request. Mitigation: a smoke test hitting `/health` after every production deploy.

**6. Model data residency. Severity: medium. Likelihood: certain if unchanged.**
The default agent model is `zai/glm-5.2-fast`. Full email bodies of European and Australian
hotel executives will be sent to it through the AI Gateway. Mitigation: this is a founder
decision, section Q. The model is a database row, changeable from the settings page without a
redeploy.

**7. Anti-spam and privacy law. Severity: medium-high when outreach starts. Likelihood: certain.**
Australian Spam Act 2003 and GDPR both apply. Mitigation: suppression check enforced in the
send path from the very first message, unsubscribe in every message, documented legitimate
interest balancing test. Section K.4.

**8. Clay cost runaway. Severity: medium. Likelihood: moderate.**
An automated operation that can enrich without a ceiling can spend without a ceiling.
Mitigation: `EnrichmentBudget` with monthly, per-entity and per-run ceilings, checked before
the call. Section J.8.

**9. `eve` is pre-1.0. Severity: medium. Likelihood: moderate.**
Version 0.29.4. The agent deployment, the durable session model, the sandbox and the bridge
all depend on it. Breaking changes should be expected. Mitigation: pin the version, read the
changelog before upgrading, and note that the work queue itself is ours (Postgres and Prisma),
so the expensive part is not eve-dependent.

**10. OAuth tokens stored unencrypted. Severity: medium. Likelihood: low.**
`account.accessToken` and `account.refreshToken` are plain columns. Anyone with a database
connection reads every connected mailbox. Mitigation: at one user this is acceptable. Revisit
before the second person connects a mailbox.

**11. Search does not scale. Severity: low. Likelihood: certain eventually.**
`SearchService.quick` uses `contains` with `mode: "insensitive"`, which is an unindexed
`ILIKE '%term%'` scan. Fine at thousands of rows, slow at hundreds of thousands. Mitigation:
`pg_trgm` and a GIN index when it hurts. One migration. Not a today problem.

**12. Latency to Sydney. Severity: low if handled, high if ignored.**
Prisma is chatty. A Vercel function in `iad1` talking to Postgres in Sydney adds roughly a
quarter second per query round trip. Mitigation: deploy to `syd1`. This is a project setting.

---

# Q. Open founder decisions

Ordered by urgency.

**Q1. Detach or restrict `supabase-production` from this workspace. Blocking.**
Nothing should be implemented until the environment cannot write to Production. Options:
remove the MCP server from this project's configuration (simplest), or replace its credential
with a read-only role. **My recommendation: remove it entirely. If the CRM later needs to read
Production, it should do so through the audited service path in section I, not through a
developer's MCP session.**

**Q2. Confirm Supabase as managed Postgres only, and disable the Data API. Blocking.**
Section G. Confirm that Supabase Auth, Realtime, Edge Functions and PostgREST are all off the
table, and that the Data API is disabled before the first row exists.

**Q3. Which model does the agent run on? Needed before the agent processes real contacts.**
Default is `zai/glm-5.2-fast`. Full email bodies go to it. Options: keep the default (cheapest,
raises a data residency question for EU and AU personal data), switch to Claude or another
provider through the same AI Gateway (a settings change, no redeploy, more expensive), or run
the agent without mailbox access until decided. **My recommendation: switch it, and take the
cost.** The agent reads the private correspondence of people we want as customers. That is
worth a considered provider choice rather than an inherited default.

**Q4. Outreach: send from the CRM, or from your mailbox? Shapes months of work.**
Section K.2. **My recommendation: the agent drafts, you send from your own Gmail, replies land
back automatically.** One scope change, no sending infrastructure, better deliverability, and
it defers the entire sequencer question until there is evidence it is needed.

**Q5. What is the initial target universe, concretely?**
How many businesses in the first import, from where, and at what level (properties, groups, or
both)? This determines whether the coverage view is useful on day one and whether Clay is
needed in month one or month six.

**Q6. Point in time recovery on the Supabase project?**
Micro compute plus PITR is a small monthly cost. A CRM is the record of every commercial
relationship. **My recommendation: yes.**

**Q7. Fork strategy: track upstream, or diverge deliberately?**
Merging monthly keeps improvements flowing and constrains how freely we change inherited
files. Diverging frees us and means we own every bug forever. **My recommendation: track
upstream for the first six months, keeping our changes additive, then reassess with real
evidence about how much upstream is actually shipping that we want.**

**Q8. Does anyone other than you get an account in the first year?**
The answer changes the security posture: no record-level permissions, no read audit log, and
unencrypted OAuth tokens are all fine for one person and progressively less fine after that.

---

# R. Recommended implementation sequence

Each phase ends with something that works. No phase depends on a later one.

### Phase 0: environment safety and fork hygiene
*Blocking. Nothing else starts until this is done.*

1. Detach or restrict `supabase-production` from this workspace (Q1).
2. Disable the Supabase Data API on the CRM project; confirm no RLS is expected.
3. Set `CRM_TELEMETRY_DISABLED=1` everywhere. Leave `IS_MARKETING` unset.
4. Replace `README.md`, `CLAUDE.md` and `AGENTS.md` with ours. Keep `LICENSE` intact.
5. Remove upstream branding, the marketing landing page, `posthog-js`, and upstream's
   `.github` release workflows. Keep `ci.yml`.

**Done when:** the repository is ours, reports nothing outward, and cannot reach Production.

### Phase 1: run it, locally then deployed
6. `docker compose up -d`, `bun install`, `bun run db:deploy`, `bun run db:seed`,
   `bun run dev`. Confirm all three apps start and the seeded pipeline renders.
7. Wire the Supabase CRM project: pooled `DATABASE_URL` with `?pgbouncer=true`, direct
   `DIRECT_DATABASE_URL`, both declared in `turbo.json` pass-through.
8. Deploy app, API and agent to Vercel in **`syd1`**. Google OAuth client, `ALLOWED_SIGN_IN`
   set to the aiseeyou.com domain, `BETTER_AUTH_SECRET`, `CRON_SECRET`,
   `AGENT_BRIDGE_SECRET`.
9. Sign in. Complete onboarding. Add the Context.dev key.
10. Smoke test: `/health` on the API, `GET /eve/v1/info` on the agent, one company created
    by hand and its logo resolving.

**Done when:** you can sign in to your own CRM and the agent enriches a company you add.

### Phase 2: the data model
*The only expensive-to-defer work in this plan.*

11. Migration: `Vertical` table, `Company.verticalId`, `Company.entityType`. Seed four
    verticals.
12. Migration: `EntityRelationship` and `RelationshipType`.
13. Migration: `ContactAssignment`, `ContactRoleType`, `AssignmentScope`, plus a backfill
    writing one `EMPLOYER` row per existing `Contact.companyId`. Keep `Contact.companyId`
    synced.
14. Migration: `ExternalRef` and its enums.
15. Migration: drop the `Company.domain` unique index; change `companyForEmail` to propose
    rather than auto-create.
16. Re-seed `FieldDefinition` for travel; retire the SaaS seeds.
17. Replace the `DealStage` values.

**Done when:** a hotel group, three properties, a management company, the relationships
between them, and one group contact responsible for all three can be represented and queried
in both directions.

### Phase 3: the UI catches up
18. Relabel Company as Business, Deal as Opportunity.
19. Business record sheet gains a Relationships panel (parents, children, managed properties)
    and an Assignments panel.
20. Contact sheet gains a Responsible for panel.
21. Filters: Vertical, entity type, lifecycle stage, role type, region.
22. Two views: **Today** (overdue tasks, replies since yesterday, stale opportunities) and
    **Coverage** (target entities missing a required role).

**Done when:** the founder can answer seven of the nine questions in section L.1.

### Phase 4: real data
23. Import script: businesses, relationships, contacts, assignments, `ExternalRef` rows with
    `system = PRODUCTION`, `matchedBy = IMPORT`, `confirmedAt` set only where a human verified.
24. Connect Gmail and Calendar. Let the forward-only sync start.
25. Let the agent run: company brand enrichment, contact identification, briefs.
26. Watch the enrichment queue and the blank-fact sweep for a week. Tune budgets.

**Done when:** the CRM contains the real target universe and the agent is improving it
unattended.

### Phase 5: Production read integration
27. Agree the read contract with Production (endpoint shape, fields, token).
28. Build the read client **in the agent**, plus `ProductionSnapshot` and a
    `production-refresh` task kind.
29. Surface provenance in the UI: "from Production, N hours ago".
30. Build the Production feedback queue: CRM observations that contradict Production,
    reviewed and exported by a human. **No write path.**

**Done when:** a business record shows live Production context and there is still no code
path from the CRM to a Production write.

### Phase 6: Clay
31. `EnrichmentCandidate`, `EnrichmentRequest`, `EnrichmentBudget` models.
32. `POST /intake/enrichment/candidates` with a scoped credential, HMAC verification and
    idempotency. Returns 202 and queues a task.
33. Clay observation kinds in `lib/evidence.ts`, weighted below primary sources.
34. Agent-side match, dedupe and promote, writing `ContactFact` and `ContactAssignment`.
35. Coverage-driven enrichment requests, budget-checked, queued not synchronous.

**Done when:** a coverage gap becomes a Clay request, becomes candidates, becomes evidenced
facts, becomes a contact assigned to the right entity, without a human unless the evidence is
ambiguous.

### Phase 7: outreach
36. `Suppression` model and a send-path check that cannot be bypassed.
37. Gmail scope upgrade to `gmail.compose` (drafts) or `gmail.send`.
38. `OutreachMessage`, linked to `EmailMessage` for reply attribution.
39. An agent tool that drafts from the contact brief and the Production context.
40. `Campaign` and attribution reporting.
41. Sequences only if the evidence says manual follow-up is the bottleneck.

**Done when:** the founder can see who was contacted, what was said, who replied, and what it
became.

---

## Closing note

The single most important thing in this document: **the fork is worth keeping, and the data
model is the only thing that is expensive to get wrong.** Phase 2 is four migrations and it
determines whether this CRM can describe the travel industry or merely a list of companies.
Everything else can be added later against a correct model, and almost nothing can be fixed
later against a wrong one.

The second most important thing: **detach the Production MCP server before anyone writes any
code.**
