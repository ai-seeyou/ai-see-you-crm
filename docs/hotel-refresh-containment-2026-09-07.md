# Hotel refresh containment

Two independent SELECT investigations confirm material source drift on 7 September 2026.

| Measure | Count |
| --- | ---: |
| CRM hotel profiles | 4,996 |
| Confirmed current Production property references | 4,996 |
| Current Production hotel read view | 1,948 |
| CRM properties absent from that view | 3,048 |
| Current accepted recommendation properties | 4,885 |
| Accepted properties combined with the existing view | 5,010 |
| Candidate additions | 14 |
| Candidate exclusions | 0 |

The existing hotel view requires operational run status `complete`.
The accepted measurement set contains 17 `complete` runs and 60 `completed` runs.
This report does not authorise a changed Production eligibility predicate.

CRM currently retains every imported hotel and every confirmed property reference. No reference is stale.
The first weekly reconciliation lacks a successful `fullReconciliation=true` baseline.
The initial certified full import records `fullReconciliation=false`.
The previous contraction check therefore fails to protect that first weekly run.

The correction compares the incoming count against current governed hotel references and the previous full reconciliation.
It uses the larger baseline. The existing 80 percent threshold remains unchanged.
An incoming 1,948-row manifest fails against 4,996 current references before hotel changes or reference invalidation.
No Production source, privilege, schema or credential changes occur.

Mencius implements the correction and regression test.
The coordinator independently reviews the guard and runs the complete CRM test suite.
All 1,300 tests pass on the isolated local UTC test database.
The regression verifies unchanged Company rows, property snapshots and references after rejection.
Created, updated and stale-reference counters remain zero.
Normal bounded absence reconciliation remains tested.

At 04:44:34 UTC, import run `cmtqm21t7000104ib3vdi00y0` still reports RUNNING.
Its heartbeat stops at 02:19:41 UTC. It reports 4,000 unchanged records and zero created or updated records.
Task `cmtqm1of9000004iby1kjyici` holds a lease until 08:17:45 UTC.
These records do not prove a currently executing process.
This work does not restart that task or commit another hotel import.

The separate Category evidence remains 13,184 memberships across 4,272 properties.
Eleven Category properties lack CRM links. All eleven belong to Yorkshire Dales.
The Category implementation retains those memberships as explicit unresolved links.

Release status: PR 31 merges after all CI checks pass.
Release commit: `f38ee8de6d17a2be53dd1958427c44ca2ae27a7e`.
Vercel deployment `dpl_7mcrQ3vtem2iBnHjHpQKBqGZehMF` reports READY with that exact Git SHA.
The production alias is `agent.crm.ai-seeyou.com`.
Category code and migration 67 are not part of this release.
