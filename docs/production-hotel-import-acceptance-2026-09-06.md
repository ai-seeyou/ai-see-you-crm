# Production hotel import acceptance

The complete hotel import and pinned idempotent rerun pass.
Production remains authoritative. CRM import operations perform zero Production data writes.
The separate expired operator-role cleanup remains outstanding.

## Certified source universe

The approved Production view identifies 4,996 distinct qualifying hotel properties.
Independent verification finds zero duplicate Production property IDs.

| Country code | Hotels |
| --- | ---: |
| AU | 1,321 |
| GB | 3,048 |
| NZ | 408 |
| SG | 219 |
| Total | 4,996 |

The universe contains 76 destinations. Production supplies reliable chain IDs for 1,009 hotels.
The other 3,987 hotels have no chain ID. Sixty-eight hotels also have a parent-chain ID.
Production supplies both England and United Kingdom as names for GB. CRM preserves those source values.

## Dry-run certification

- Run: `cmtpgxcwt000004kyo3znavs6`.
- Snapshot: `2026-09-06T07:06:23.850Z`.
- Qualifying and fetched hotels: 4,996.
- Distinct manifest IDs: 4,996.
- Read requests: 10, all GET.
- Created hotels: 0.
- Updated hotels: 0.
- Match exceptions: 0.
- Destinations: 76.
- Country codes: 4.
- Independent certification: PASS.

Sorted Production IDs, joined by newline, have this SHA-256 digest:

`c60eeec2202d5f586a6072b3f1e297f34487f448b26b25e4a22a8eeb2ea61439`

The canonical payload digest is:

`2149d13a10e52afa3e54fe4f83b42fb79bb69499849c04aeec3ec10297ad37da`

The independent Production digest and the recomputed CRM manifest digest match exactly.

## Deployed corrections

Production PR 65 preserves exact timestamp text in opaque pagination cursors.
Its reviewed migration hash is:

`22ae6391a383ade2d88a354f89eb7d90626144a7ed5fa8e5dbc17392b1d0d922`

The founder explicitly exempts this exact migration from the permanent no-migrations rule.
Verification finds one migration record and one v2 RPC signature.
The owner remains postgres. Execution remains STABLE and SECURITY DEFINER with an empty search path.
Only anon has the approved execution grant. The backing view has zero direct application-role grants.
The RPC verifies GET and the scoped internal capability before reading the approved view.

CRM PR 24 accepts valid offsets on nested governed timestamps.
CRM PR 25 rejects repeated pagination cursors before business writes.
CRM PR 26 gives bounded import transactions an explicit timeout and gates incremental schedules on completed import evidence.
CRM PR 27 limits write transactions to 100 hotels while preserving complete-page checkpoints.
Its independent review, 29 focused tests, 438 agent tests, and full CI pass.
The live deployment is `crm-agent-kbyfvqyyo-ai-see-you.vercel.app`, at release commit `f932cf65bc5a4cfc93cb40f8dc8700989348acba`.

## Committed import

The complete import succeeds in run `cmtpikhh8000004l80jbf9wdp`.
It processes all 4,996 certified hotels with zero match exceptions and zero review items.
Its source ID and payload digests match the independent dry-run certification exactly.
The run starts at `2026-09-06T07:52:21.116Z` and completes at `2026-09-06T07:53:52.488Z`.
Its runtime is 91.372 seconds. It creates 475 hotels, updates 21, and verifies 4,500 unchanged hotels.
Across committed pages, the import creates 4,768 hotels and enriches the original 228 Sydney hotels.
It records 1,012 structural relationships, including 1,009 hotel-chain links and three chain-parent links.

### Recovered failures

The first three attempts exceed the inherited five-second transaction timeout.
Each transaction rolls back. PR 26 corrects that timeout.
One subsequent request returns transient HTTP 503 before reads. The next retry succeeds without configuration changes.
Run `cmtphywow000004lcroof8bl9` commits nine pages containing 4,500 hotels.
It creates 4,293 hotels and updates 207 existing Sydney hotels.
Its final 496-record transaction exceeds the bounded 120-second timeout and rolls back.
Earlier committed pages remain intact. PR 27 corrects this failure with smaller write chunks.
The final successful run recovers those pages through Production-ID matching without duplicate creation.
The interval from the first committed attempt to successful completion is 41 minutes and 30 seconds.
This interval includes failed attempts, reviews, deployments, and the controlled retry pause.

## Post-import checks

Independent final database verification passes.
CRM contains 4,996 confirmed active Production hotel references and 4,996 distinct linked businesses.
Every hotel has the HOTEL entity type and HOTEL vertical.
Every hotel has a synchronized profile and a Production snapshot.
Missing references, orphan profiles, orphan snapshots, invalid relationships, stale references, and duplicate IDs total zero.
The recomputed CRM Production-ID digest matches the certified Production digest exactly.
Shared domains span 162 domains and 1,616 properties. Each property retains its distinct business identity.

The deployed daily and weekly schedules satisfy their completed-import prerequisite.
Daily incremental synchronization runs at `17 2 * * *` UTC.
Weekly full reconciliation runs at `47 3 * * 0` UTC.
New qualifying hotels enter through the same Production-ID matching and read-only contract.
The pinned committed idempotency rerun completes successfully after capability rotation.
Run `cmtpitd6k04r104l841ckrnim` verifies 4,996 unchanged hotels, zero creates, zero updates, and zero exceptions.
It starts at `2026-09-06T07:59:15.452Z` and completes at `2026-09-06T08:00:53.845Z`.
Its runtime is 98.393 seconds.
Independent post-rerun certification passes for totals, both digests, relationships, and the incremental activation gate.
The import state has no pending cursor, snapshot, or run lease.
Its source watermark is `2026-09-06T05:44:28.034Z`.
The first future scheduled incremental run remains a subsequent operational check.

## Internal capability rotation

The independently reviewed rotation succeeds after final import certification.
The capability exists only in process memory and standard input. No raw secret file is created.
The rotation replaces exactly two verifier literals and updates one scoped Production Edge secret.
It leaves the CRM outer read token unchanged and adds no Production credential to CRM.
Post-rotation SELECT verification passes for both RPCs.
Ownership, ACLs, GET enforcement, STABLE execution, SECURITY DEFINER, and the empty search path remain unchanged.
The old verifier is absent. The precision migration still has exactly one record.

The new public verifier SHA-256 is:

`80aa86ad4dd3cae988016357729bfbed6ce84f6661cbc959587000c6c072457a`

This hash is not the read capability. Do not restore old verifier literals from historical migrations.
The pinned rerun verifies live GET access after rotation. No old-token replay is claimed without that token.

## Remaining programme work

The expired temporary operator role needs Supabase administrator removal as specified below.
Production retains four documented baseline CI failure categories: authentication inventory, dependency advisories, secret-shaped content, and inventory drift.
The founder exception applies only to the reviewed PR 65 changes. It does not waive future regressions.
The next programme milestone is commercial workflow acceptance with the live hotel universe.
Gmail, Calendar, private correspondence processing, and outbound email remain outside current execution authority.

## Security cleanup

The operator CLI creates an unintended temporary login role during its default linked-query setup.
The reviewed replacement invocation prevents further role creation.
For approved linked operator queries, use `SUPABASE_DB_PASSWORD=unused-no-login-role supabase db query --linked`.
The dummy value is not a credential. It skips the unused CLI login initialization and retains Management API authentication.
This invocation does not authorize additional SQL or additional targets.
The incidental role password expires at `2026-09-06T06:39:38.77713Z`. Verification finds zero active sessions.
The role retains postgres membership and effective privileges on three extension relations.
Independent verification at `2026-09-06T07:59:25.615854Z` again finds its expired password and zero active sessions.
Dependency inspection finds no owned objects, dependent objects, or legitimate active sessions.
Reviewed cleanup attempts fail with PostgreSQL permission errors and roll back completely.
Complete removal requires Supabase-managed role administration. This cleanup does not block the independent CRM read path.

### Supabase security-cleanup request

Project reference: `tnskqujimizlsmsmonor`.
Remove the expired, unused CLI login role with a platform administrator that can administer this role.
The operator role cannot administer it. PostgreSQL rejects both reviewed cleanup attempts with insufficient privileges.
Do not change PUBLIC grants or unrelated consumers.
The exact removal statement is:

```sql
DROP ROLE cli_login_postgres;
```

Before execution, confirm expiry, zero active sessions, zero owned objects, zero dependent objects, and unchanged postgres membership.
The reviewed guarded transaction is available at `/private/tmp/crm-retire-expired-cli-role.sql`.
It aborts when any dependency or role-state check changes. It contains no CASCADE or unrelated privilege changes.
After execution, confirm the role is absent from `pg_roles` and its membership rows are absent.
Then verify the CRM GET endpoint and the existing Production application health checks.
Do not create another temporary login to execute or verify this cleanup.

## Boundary accounting

CRM reads Production only through the scoped GET contract. Import business writes target the separate CRM database.
Approved operator deployment changes and failed role-cleanup transactions are recorded separately from import data operations.
Do not describe the approved Production migration as zero administrative mutations.
