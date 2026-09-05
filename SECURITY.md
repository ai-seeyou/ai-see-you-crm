# Security

This is AI See You's private, internal CRM. It is not a public service and takes no
external vulnerability reports. Raise anything you find directly with the founder.

Upstream (`trycompai/crm`) has its own security policy for the open source project.
Do not send reports about this fork there.

## The rules that come before everything else

**AI See You Production is a prohibited write target.** No SQL, no migration, no
schema change, no data write and no mutating API call, from this application, from a
script in this repository, or from a developer or agent tool session working in it.
The repository contains no Production credential and no Production write path, and
must not acquire one.

**One database.** `DATABASE_URL` points at the dedicated AI See You CRM database or
at a local Postgres. Never at Production. Never at the Research Lab.

**Production data, when Phase 5 authorises reading it, is read-only, cached, clearly
labelled and never joined for an authoritative decision.** The CRM does not mirror
the Production dataset.

## What this is, and what it assumes

Built for **one organisation of authenticated internal users**. It is not a hardened
public or multi-tenant service boundary, and the design says so out loud in several
places. The limits below are real and worth reading before real customer data goes
in.

**Sign-in is the entire authorisation model.** `ALLOWED_SIGN_IN` decides who gets in.
After that, every signed-in person can read and write every record. There are no
roles on records, no per-record permissions and no organizations. That is deliberate:
a permissions check that always returns `true` reads like a real one at review time.
It is correct for a founder-led team and it is the thing to revisit first when a
second person, a contractor or a regional partner needs an account.

An unset `ALLOWED_SIGN_IN` fails closed: nobody can sign in. A list naming a consumer
domain such as `gmail.com` is an open door, which is why single addresses are
supported.

**Operators can read everything.** Whoever runs the deployment has the database, the
environment and the logs. Nothing here protects data from the person hosting it.

**OAuth tokens are stored unencrypted.** `account.accessToken` and
`account.refreshToken` are plain columns, so anyone with a database connection can
read every connected mailbox. Acceptable at one user. Revisit before a second person
connects a mailbox.

**The agent reads mail.** Gmail and Calendar access is a condition of signing in,
because reading the mailbox is what the CRM is for. The research agent reads message
bodies, meeting attendees and signature blocks belonging to real people who did not
sign up for this. It is deliberately unrestricted on the read side and constrained on
the write and egress sides. See `apps/agent/agent/skills/data-boundaries.md`. AI See
You is the data controller for those mailboxes, and for the personal data of the
contacts in them under Australian and EU law.

**The agent sends data to the model provider and to vendors.** The model is reached
through the Vercel AI Gateway, and full email bodies reach it. Which model is a
database row, changeable from the settings page. Each optional key in `.env.example`
turns on one more vendor the agent can query, and a query carries whatever it needs
to ask the question. With no keys set, nothing leaves except Google's own APIs.

**The sandbox has no network and no database.** `apps/agent/agent/sandbox/sandbox.ts`
sets `deny-all` egress on the backend factory so it cannot be forgotten per session,
and `DATABASE_URL` is never given to it. CRM access is authored tools only. Keep both
properties.

**Vendor URLs are fetched through an SSRF guard.** `packages/db/src/safe-fetch.ts`
resolves DNS, blocks private and link-local ranges for IPv4 and IPv6, caps redirects
and times out. Every fetch of an untrusted URL goes through it.

**The internal cron routes are guarded by a shared secret.** `CRON_SECRET` is the
whole guard on `POST /internal/sync/mailboxes` and the retention and prune routes,
and they refuse to run without it. Treat it like a password.

**Sessions depend on one shared value.** The API and the app both verify against
`BETTER_AUTH_SECRET`. Rotating it signs everyone out, which is the intended way to
revoke every session at once.

**An API key is currently a full user session.** Better Auth's `apiKey` plugin is
configured with `enableSessionForAPIKeys`, so a key can do anything its owner can.
That is acceptable for our own scripts and is the wrong shape for an enrichment
vendor. Clay gets a scoped intake credential in its own phase, not a user key.

**The Supabase Data API must stay disabled.** No table has row level security,
because the application has never needed any: Prisma connects as a privileged role
and authorisation is enforced in the API. If PostgREST were enabled and an anon key
leaked, every contact, email body, deal amount and OAuth token would be readable.

**This install reports nothing.** Upstream's telemetry is disabled in code, has no
credential, and is disabled again by environment variable.

## Deploying it safely

- `ALLOWED_SIGN_IN` is a domain we control. Never a public mail provider.
- Generate `BETTER_AUTH_SECRET` fresh. Any value in an example file is not a secret.
- Serve both processes over HTTPS. Secure cookies switch on with `NODE_ENV=production`.
- Set `CRON_SECRET`.
- Keep the database off the public internet and the Supabase Data API off.
- Start with no optional API keys and add them one at a time, so we know what is
  leaving.
- Deploy in the same region as the database.

## Dependencies

Updated deliberately rather than automatically. A CVE in a dev-only tool and one in
the request path deserve different urgency, so say what the exposure is.
