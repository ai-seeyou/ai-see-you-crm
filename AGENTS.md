# Rules for changing this repository

This is the **AI See You CRM**: private, internal, forked from
[`trycompai/crm`](https://github.com/trycompai/crm) under the MIT licence.

Read [`README.md`](./README.md) for what it is for and
[`docs/ai-see-you-crm-foundation-audit.md`](./docs/ai-see-you-crm-foundation-audit.md)
for the architecture and the phase plan. Neither is optional context.

---

## Part one: the AI See You rules

These come first because breaking one of them is not a bug, it is an incident.

### Production is a prohibited write target

**Production says what a travel business IS. The CRM says what our COMMERCIAL
RELATIONSHIP with that business IS.**

- **Never write to AI See You Production.** No SQL, no migration, no schema change,
  no data write, no API call that mutates. Not through a tool, not through an MCP
  server, not to fix something quickly.
- **Never connect this application to the Production database.** No Production
  connection string or service key is permitted anywhere in the CRM.
- **The agent deployment can hold one scoped token for the GET-only Production read
  contract.** The app and API deployments must not hold it.
- **The finished repository contains no Production write path.** If you find one,
  stop and report it.
- Phase 5 authorises reads only through the audited contract described in the audit.

If a task seems to require a Production write, it does not. Report it as a blocker.

### One database

`DATABASE_URL` points at the dedicated AI See You CRM database, or at a local
Postgres. Never at Production. Never at the Research Lab.

`packages/db/scripts/require-local-db.ts` guards `db:migrate`, `db:push`, `db:reset`
and `db:seed`. **Do not work around it.** The test suite refuses to run without a
separate `TEST_DATABASE_URL` naming a database that ends in `_test`, because the
integration tests delete the organization row and every member. That guard is the
only thing between a `git push` and a wiped database.

### Work inside the authorised phase

The audit defines phases 0 to 7. **Do the phase you were asked for and stop.**

- No speculative changes. No refactor you were not asked for. No "while I was in
  there".
- No schema change, no migration and no new Prisma model outside a phase that
  authorises one.
- No new integration, no new vendor client and no new credential outside its phase.
- No deployment, ever, without explicit approval.
- If you believe the phase is wrong, say so and stop. Do not widen it yourself.

**Finish the whole phase.** Partial delivery reported as complete is worse than a
blocker reported honestly.

### Telemetry stays off

This install reports nothing to anyone. `HARD_DISABLED` in
`packages/telemetry/src/disabled.ts`, blank credentials in `project.ts`, and
`CRM_TELEMETRY_DISABLED=1` in the environment. An upstream merge that restores a
send path is a regression. `packages/telemetry/test/no-egress.spec.ts` is the check.

### Keep upstream merges possible

The fork tracks upstream for now. Every change to an inherited file makes the next
`git merge upstream/release` harder.

- **Prefer additive, file-local changes.** New models in new migrations, new tools in
  new files, new routers in new modules.
- Modify inherited files as rarely as you can, and in small, clearly described
  commits when you must.
- **`LICENSE` is never edited.** The Comp AI copyright notice stays exactly as it is.

### Do not use em dashes or en dashes

Not in code, comments, documentation, commit messages or replies. Use commas,
colons, periods or parentheses.

---

## Part two: read the doc for the area you are touching

Plain paths, not imports. They are not in your context until you read them, and the
rules in them are not optional. Tell the user which ones you read.

| Working on | Read first |
| --- | --- |
| Anything in `apps/api`: tRPC, auth, logging, sync, deletes, caching | `docs/api.md` |
| `apps/agent`: the eve research agent, tools, tasks, dispatch | `docs/agent.md` |
| `.env`, configuration, which variables exist and why | `docs/environment.md` |
| UI in `apps/app` or `packages/ui` | `docs/design.md` |
| Deal amounts, totals, charts, exchange rates | `docs/currency.md` |
| The record sheet's Agent tab | `docs/agent-panel.md` |
| Settings, connections, integrations, the intake endpoint | `docs/connections.md` |
| The tracking script, the collector, form submissions | `docs/tracking.md` |
| Running it locally, DB commands, secrets | `docs/setup.md` |
| The data model, the phase plan, why anything is the way it is | `docs/ai-see-you-crm-foundation-audit.md` |

These docs were written by upstream and describe how the code actually works, which
is why they are kept. Where one describes a product decision of upstream's rather
than the code, read it as history.

Also check `.agents/skills/` for a relevant skill before starting: better-auth,
prisma, nestjs-trpc, eve, shadcn and nuqs each have one.

---

## Part three: engineering rules, inherited and kept

These are upstream's, they are good, and they still apply.

### Always true

- **Never add code comments.** Not to new code, not to code you edit. The exception
  is a comment that records a decision somebody would otherwise undo, such as the
  ones on the telemetry hard-disable.
- **Intelligence lives in `apps/agent`, never in the API.** No vendor client, no
  enrichment, no scoring, no identity matching in Nest. It writes an `AgentTask` row
  and lets the agent decide. When Clay arrives it arrives in the agent. See
  `docs/api.md`.
- **One `.env`, at the repo root.** `.env.example` is its documentation: add every new
  variable there with a note on what it does, and declare it in
  `apps/api/src/config/env.validation.ts` if the API reads it. Never add a
  per-package `.env`.
- **Anything an install might not have is optional and must never throw.** A missing
  key removes a capability. `apps/agent/agent/lib/capabilities.ts` is the pattern.
- **`packages/ui` is the single source of truth for UI.** Shared shadcn components
  only. A new variant is implemented there, not overridden at the call site.
- **eve's own docs ship in `apps/agent/node_modules/eve/docs`** and match the
  installed version. Read the relevant guide before writing eve code rather than
  working from memory. Guessing typechecks, builds, and then behaves differently.
- **Commits by an agent carry a `Co-Authored-By` trailer.** Upstream forbade it; we
  want the provenance.

### A server page computes. A client component renders.

A client component must never import a server package. `@crm/auth` and `@crm/db` are
server packages: their barrels reach Prisma, which reaches `pg`, which reaches `dns`.
The bundler follows that chain into the browser and the build fails with
`Module not found: Can't resolve 'dns'`.

The import trace is the whole error. Read it from the bottom: the last line is the
page, the line above is the client component that leaked, and the top is the Node
module that cannot exist in a browser.

The page does the work and hands over plain data:

```tsx
// page.tsx, server
import { describeSlackScopes, SLACK_SCOPE_GROUPS } from "@crm/auth";

const groups = groupScopes(status.scopes);
return <SlackScopeGroups groups={groups} />;
```

```tsx
// slack-scope-groups.tsx, client
"use client";

export type ScopeGroup = { id: string; label: string; scopes: ScopeLine[] };

export function SlackScopeGroups({ groups }: { groups: ScopeGroup[] }) { }
```

Rules that follow:

- The client component owns its own prop types. It does not re-export a server type
  to get them.
- Anything interactive (an accordion, a dialog, a search field) is a client component
  that receives finished data. It never derives it.
- A `"use client"` file may import from `@crm/ui`, the tRPC client, and React.
  Anything else needs checking.
- The server page is where `await` and secrets live. The client file has neither.

### Constants belong in one file per area, not beside their first use

A number somebody will want to tune goes in a named config module for its area, not
at the top of whichever file happened to need it first. Somebody changing a timeout
must not have to know which file to open.

```ts
// dispatch-config.ts
export const DISPATCH = {
  sweep: { timeoutMs: 4 * MINUTE_MS, staleQueueMs: 5 * MINUTE_MS },
  task: { leaseMs: 10 * MINUTE_MS },
} as const;
```

`apps/agent/agent/lib/dispatch-config.ts` is the pattern. Group by concern, not by
the file that uses it. Derive units from one base (`MINUTE_MS`). Use `as const`, so
the values are literal types. No magic numbers inline. One convention across the
codebase.

### Parse at the boundary, never pass `Record<string, unknown>` around

Untyped data (a Prisma `Json` column, a webhook body, an API response) is parsed into
a domain type **at the moment it enters the process**, with Zod, in a module that owns
that shape. Every consumer downstream receives the parsed type and nothing else.
`Record<string, unknown>`, `unknown` casts and one-off `recordOf()` helpers are how a
shape becomes unknowable and a typo becomes a runtime bug two files away.

`packages/validation/src/agent-manifest.ts` is the pattern. A shape that crosses a
package boundary lives in `packages/validation/src`, one module per shape, imported by
subpath (`@crm/validation/agent-manifest`). Rules that follow:

- The schema describes what is **actually stored**, not the loosest thing that parses.
  If a test fixture fails the schema, fix the fixture: a fixture that omits required
  fields is testing data that cannot exist.
- Parse failure is a real error with a real message. Do not swallow it into an empty
  array, because "unreadable manifest" and "no actions" are different problems and
  only one of them is the user's fault.
- Derive types with `z.infer`. Never hand-write an interface beside a schema; they
  drift.

### Design

@docs/design.md

---

## Part four: report every issue, in ASD-STE100

Do not bury a known problem inside a paragraph. A problem inside prose is a problem
nobody reads. Report **every** issue, including ones you caused, in a list at the end
of your reply.

Write every message, every report and every issue in **ASD-STE100** (Simplified
Technical English):

- One idea per sentence. Maximum 20 words.
- Active voice. Present tense. No conditionals.
- One word for one meaning. Do not use synonyms for variety.
- Say the effect, not only the cause.
- No hedging. Never "may", "might", "possibly", "somewhat".

Use exactly this shape:

```
## Issues

1. BROKEN. Slack is not connected. Agents that post to Slack fail.
   Fix: connect Slack in Settings, Connections.
2. RISK. A run longer than 5 minutes is cancelled. Work is lost.
   Fix: not done. Needs a separate execution lease.
3. NOT DONE. The manual run button shows on event-only agents.
```

Rules for the list:

- One line for the problem. One line for the fix.
- Start each with **BROKEN**, **RISK**, **NOT DONE**, or **UNKNOWN**.
- **BROKEN** is failing now. **RISK** fails later. **NOT DONE** is unbuilt.
  **UNKNOWN** is not investigated.
- If you introduced it, write **I caused this** on the fix line.
- Zero issues? Write `## Issues` then `None.`
