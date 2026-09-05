# AI See You CRM

**AI See You's internal CRM and commercial operating system.** Private. Not a product.

This repository is a fork of [`trycompai/crm`](https://github.com/trycompai/crm), an
open source agentic CRM by Comp AI, used under the MIT licence. See
[Licence](#licence).

---

## What this is for

AI See You has a large universe of travel businesses: hotels, hotel groups,
destinations, and in time cruise lines and tour operators. Two systems describe
them, and the split between them is the most important rule in this repository.

> **Production says what a travel business IS.**
> **CRM says what our COMMERCIAL RELATIONSHIP with that business IS.**

The CRM is the canonical source for contacts, commercial relationships, prospect
status, outreach, activities, opportunities, meetings, sales history, customer
history and enrichment. It is not a second copy of Production, and it never
becomes one.

## The rules that are not negotiable

**1. The CRM never writes to AI See You Production.**
Not through an API, not through a database connection, not behind a feature flag,
not "just this once" for a data fix. There is no write path in this repository and
none may be added. If the CRM learns something Production should know, it goes into
a review queue for a human to export. Production's own process applies the change.

**2. The CRM connects to exactly one database.**
The dedicated AI See You CRM database, or a local Postgres for development.
`DATABASE_URL` must never point at AI See You Production or at the AI See You
Research Lab. No Production database or service-role credential is permitted.
The agent deployment holds one scoped token for the GET-only Production read contract.

**3. Production data is read, cached and clearly labelled, never absorbed.**
The link between a CRM record and a Production business is a canonical identifier,
held in one place. The CRM does not mirror the Production dataset.

**4. This install reports nothing to anyone.**
Upstream sends anonymous usage counts to Comp AI once a day. That is disabled in
code, has no credential to send with, and is disabled again by environment
variable. See [Telemetry](#telemetry).

**5. Agents work inside the authorised phase and nowhere else.**
No speculative refactors, no "while I was in there" changes, no schema changes
outside a phase that authorises them. See [`AGENTS.md`](./AGENTS.md).

## Where we are

| Phase | State |
| --- | --- |
| **Phase 0** Fork hygiene, telemetry off, our documentation, upstream branding removed | **Done** |
| **Phase 1** Supabase wiring, first deployment, Google sign-in | **Done** |
| **Phase 2** The data model: verticals, entity types, relationships, contact assignments, external references | **Done** |
| **Phase 3** UI for relationships and coverage | **Done, visual finishing remains** |
| **Phase 4** Import the real target universe | In progress through Production |
| **Phase 5** Production read integration | In progress, scoped GET-only contract |
| **Phase 6** Clay enrichment | Not started |
| **Phase 7** Outreach | Not started |

The full reasoning behind every phase, and the audit of what we inherited, is in
[`docs/ai-see-you-crm-foundation-audit.md`](./docs/ai-see-you-crm-foundation-audit.md).
**Read it before proposing architecture.**

### Not part of the current phase

Clay, Gmail sending, Calendar, Slack, website tracking, the custom agent builder
and any Production integration are all out of scope until the phase that
authorises them. The code for several of them is inherited and present. Present is
not the same as authorised.

## Architecture

Three deployments and a Postgres. They share `DATABASE_URL` and
`BETTER_AUTH_SECRET` and nothing else.

| Path | What it is | Port |
| --- | --- | --- |
| `apps/app` | Next.js App Router front end | 3000 |
| `apps/api` | NestJS API: HTTP, auth, tRPC, mailbox sync | 3001 |
| `apps/agent` | The research agent, built on [eve](https://eve.dev) | 2000 |
| `packages/db` | Prisma schema, migrations, shared Postgres client | |
| `packages/auth` | Better Auth config and the sign-in allow list | |
| `packages/ui` | shadcn/ui components and the theme | |
| `packages/env` | Finds and loads the root `.env` | |
| `packages/validation` | Shared zod schemas for anything crossing a boundary | |
| `packages/telemetry` | Inherited, permanently disabled | |

Turborepo on Bun. Prisma over Postgres. tRPC from the API, with a generated REST
bridge and OpenAPI document at `/openapi.json`. Better Auth for identity. The agent
is its own deployment with its own work queue, so it keeps running with the browser
closed.

**The load bearing architectural rule, inherited and kept: intelligence never lives
in the API.** Nest reports that something happened by writing a row. The agent
decides what it means. No vendor client, no scoring, no enrichment and no identity
matching in `apps/api`. When Clay arrives, it arrives in `apps/agent`.

## Running it locally

You need [Bun](https://bun.com) and Docker. Nothing here contacts a hosted service.

```sh
cp .env.example .env          # then fill in the values below
bun install

docker compose up -d          # Postgres on :5432

bun run db:deploy             # apply migrations to the LOCAL database
bun run db:seed               # optional: a demo pipeline to look at
bun run dev
```

The app is on [localhost:3000](http://localhost:3000), the API on
[localhost:3001](http://localhost:3001).

`DATABASE_URL` in `.env.example` already points at the Docker Postgres. **Leave it
pointing at a local database until Phase 1 is approved.** `bun run db:migrate`,
`db:push`, `db:reset` and `db:seed` all refuse to run against a non-local database
by design (`packages/db/scripts/require-local-db.ts`). Do not work around that
guard.

### The values to set

| Variable | What to put in it |
| --- | --- |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `ALLOWED_SIGN_IN` | `dave@ai-seeyou.com` only |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | A Google OAuth client. Both or neither. Phase 1. |

`ALLOWED_SIGN_IN` is the entire authorisation model. An unset value means nobody can
sign in, which is the safe direction to fail. V1 permits only the founder's exact
nominated Google email address, `dave@ai-seeyou.com`. A company domain is not permitted. After sign-in,
the founder can read and write every record. See [`SECURITY.md`](./SECURITY.md).

`.env.example` is the full list with a note on each variable.

## Tasks

| Command | |
| --- | --- |
| `bun run dev` | Prepare the local database, then run everything in watch mode |
| `bun run build` | Build all apps and packages |
| `bun run test` | Run the test suite (needs `TEST_DATABASE_URL`) |
| `bun run check-types` | `tsc --noEmit` everywhere |
| `bun run lint` / `format` | [Biome](https://biomejs.dev) |
| `bun run lint:slop` | [oxlint](https://oxc.rs) |
| `bun run db:migrate` | Create and apply a migration, local only |
| `bun run db:studio` | Prisma Studio |

Scope any of them with a Turborepo filter: `bun run dev --filter=api`.

## Telemetry

**This install reports nothing.** Upstream sends one event of banded counts a day to
Comp AI's PostHog project. Our contact volumes, agent tool usage and operating tempo
are commercial information, so that is off, three times over:

1. `HARD_DISABLED` in `packages/telemetry/src/disabled.ts` does not read the
   environment, so no missing variable can turn it back on.
2. `packages/telemetry/src/project.ts` has no PostHog key and no host, so there is
   no destination to send to.
3. `CRM_TELEMETRY_DISABLED=1` is set in `.env.example` and in CI.

`packages/telemetry/test/no-egress.spec.ts` proves it, without needing a database.
The client-side `posthog-js` analytics on upstream's marketing page went with the
page. `packages/telemetry` and its `posthog-node` dependency remain in the tree so
that upstream merges stay clean; nothing constructs a client.

## Documentation

Ours:

| File | |
| --- | --- |
| [`docs/ai-see-you-crm-foundation-audit.md`](./docs/ai-see-you-crm-foundation-audit.md) | The audit of the fork and the target architecture. Read it first. |
| [`AGENTS.md`](./AGENTS.md) | Rules for anyone, human or agent, changing this repository |
| [`SECURITY.md`](./SECURITY.md) | What the security model is and what it assumes |

Inherited from upstream and still accurate. These describe how the code actually
works and are worth keeping. Where they describe upstream's product decisions rather
than the code, read them as history.

| File | |
| --- | --- |
| `docs/api.md` | tRPC, auth, logging, mailbox sync, deletes, caching |
| `docs/agent.md` | The eve agent: tools, evidence, tasks, dispatch, sandbox |
| `docs/environment.md` | Every variable and why it exists |
| `docs/design.md` | UI rules |
| `docs/setup.md` | Local development detail |
| `docs/currency.md` | Deal amounts, totals and exchange rates |
| `docs/agent-panel.md` | The record sheet's Agent tab |
| `docs/connections.md` | Settings, integrations, the intake endpoint |
| `docs/tracking.md` | The website tracking script and collector |
| `docs/telemetry.md` | What upstream sent, and why ours sends nothing |

## Licence

[MIT](./LICENSE).

This repository is a derivative work of `trycompai/crm`, copyright 2026 Comp AI, used
under the MIT licence. **The upstream copyright notice and the licence text stay in
`LICENSE` and must not be removed or rewritten.** The AI See You copyright line sits
beneath it and covers our modifications only.

MIT imposes no copyleft, so this fork may stay private and our changes need never be
published. It grants no warranty and no patent licence.

`CHANGELOG.md` is upstream's release history up to the commit we forked from. It is
kept as a record of what we inherited and is no longer maintained.
