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

### 1b, deployed

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

## Phase 2: the travel data architecture

Audit section H.3 and H.4. Additive migrations only. `Company` stays the physical
table. `Contact.companyId` is retained and kept synchronised with the single
primary employer assignment.

| # | Migration | State |
| --- | --- | --- |
| 1 | `Vertical`, `Company.verticalId`, `Company.entityType`, seed four verticals | |
| 2 | `EntityRelationship`, `RelationshipType` | |
| 3 | `ContactAssignment`, `ContactRoleType`, `AssignmentScope`, backfill | |
| 4 | `ExternalRef` and its enums | |
| 5 | Drop the `Company.domain` unique index, change `companyForEmail` | |
| 6 | Travel `FieldDefinition` seeds, replace the `DealStage` values | |

Refused by design: a `parentId` tree, Production identifiers stored as custom
fields, any Production write path.

### Acceptance test

Synthetic data only. One hotel group, three properties, one management company,
typed relationships between them, one senior group contact employed at the group
and responsible for all three properties. Both directions queryable. No reliance
on a unique corporate domain for property identity. Canonical external references
represented.

## Phase 3: make it useful

Audit section R items 18 to 22, plus the founder brief.

- Company reads as Business, Deal reads as Opportunity, in user-facing language.
- Business record sheet: a Relationships panel and an Assignments panel.
- Contact record sheet: a Responsible for panel.
- Filters: vertical, entity type, lifecycle stage, role type, region.
- `TODAY`: overdue tasks, recent replies, stale opportunities, follow-ups.
- `COVERAGE`: target businesses missing a required commercial role.

## Workstreams

| Id | Owns | Agent |
| --- | --- | --- |
| WS-A | Infrastructure and deployment | Coordinator |
| WS-B | Phase 2 data architecture | Child |
| WS-C | Phase 3 product and UI | Child |
| WS-D | Independent adversarial QA | Child, never the one that implemented |

The agent that implements a material change never certifies it.

## Programme exclusions

Not in this programme: Clay, real hotel or contact import, the Production read
API, Production synchronisation, Gmail sending, automated outreach, campaigns,
sequences, suppression, website tracking activation, Slack activation, cruise
import, tour operator import. The schema supports future verticals. This
programme does not populate them.
