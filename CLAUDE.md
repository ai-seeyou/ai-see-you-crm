# AI See You CRM

Private, internal. Forked from `trycompai/crm` under the MIT licence.

## Non-negotiable, before anything else

1. **AI See You Production is a prohibited write target.** No SQL, no migration, no
   schema change, no data write, no mutating API call, through any tool or MCP
   server. Do not connect this application to Production. No Production credential
   belongs in this repository.
2. **One database.** `DATABASE_URL` points at the dedicated AI See You CRM database
   or a local Postgres. Never Production. Never the Research Lab.
3. **Work inside the authorised phase only.** No speculative changes, no unrequested
   refactors, no schema changes outside a phase that authorises them, no deployments
   without explicit approval.
4. **Telemetry stays off.** This install reports nothing to anyone.
5. **No em dashes or en dashes**, anywhere: code, comments, docs, commit messages,
   replies.

Production says what a travel business IS. The CRM says what our COMMERCIAL
RELATIONSHIP with that business IS.

## Read these

- `docs/ai-see-you-crm-foundation-audit.md` for the architecture and the phase plan.
- `README.md` for what this is and how to run it.

@AGENTS.md
