# Category implementation and hotel refresh containment

Project: AI See You CRM.
Memory backend: local markdown. No Production memory writes.
Second pass complete. No additional items remain outside this record and linked receipts.

## Actions taken

- Implement Category snapshot, registry, membership and active-pointer Prisma models with migration 67.
- Implement strict shared schemas, bounded GET transport, digest validation, idempotent synchronisation and atomic activation.
- Gate first activation on an explicit certified snapshot. Normal cron calls remain inert before activation.
- Add Category filters across Businesses, Contacts and Coverage, including saved views and read-only Business information.
- Derive contacts through the same matching assigned Business. Do not duplicate editable Category fields.
- Require matching profile and confirmed, current Production references for all filter and display links.
- Preserve all source memberships, including unresolved property links.
- Run 1,300 local CRM tests, full type checking and focused lint checks successfully.
- Independently review API predicates, synchronisation, and the exact Production contract artifact.
- Verify seven Category intersection sets against the existing local 4,996-hotel copy.
- Commit Category code d28aaf5 and push draft CRM PR32: https://github.com/ai-seeyou/ai-see-you-crm/pull/32.
- Independently identify the first full-reconciliation contraction gap and implement a bounded guard.
- Merge CRM-only PR31 after CI passes. Release commit f38ee8de6d17a2be53dd1958427c44ca2ae27a7e.
- Verify Vercel READY deployment dpl_7mcrQ3vtem2iBnHjHpQKBqGZehMF at that SHA, alias agent.crm.ai-seeyou.com.

## Decisions and authority

- Category uses the nine canonical current registry entries and certified authored prompt coordinates.
- Latest accepted measurement means sealed, commercially certified and non-false trend validity.
- Do not substitute operational run status spelling for accepted measurement semantics.
- Category OR combines with other dimensions through AND.
- Existing Production GET capability remains the only CRM source transport. No DB or service-role credential enters CRM.
- The new Production migration requires a separate exact founder exception. PR65 and PR66 exceptions do not transfer.
- Do not merge or deploy the Category feature before Production authority and live certification.
- Do not change the hotel view while resolving Category delivery. The material source-universe change requires founder authority.
- No hosted mutations occur during this implementation, except approved GitHub and CRM deployments. Local tests write only test databases.
- No enrichment, mailbox connection or outbound sending occurs.

## Independent Production review

Production worktree: /private/tmp/tri-crm-category-read, branch feat/crm-category-read.
Commit: 15e67453b64772fa28bd61fbccf367f90b337560.
Migration: supabase/migrations/20260907230000_crm_category_read_contract.sql.
SHA-256: ee3d2dba6cd4fc2a35fd2834e6a08224a903bb0086f4e56f393e87b9f3b399ee.
Reviewer confirms all 4,105 full authority coordinates, including 1,095 exclusions.
Fourteen Deno tests and eight actual SQL fault cases pass.
Actual SQL output passes CRM validation for normal, empty and microsecond cases.
UTC and Sydney sessions produce the same snapshot identity.
GET with the capability succeeds. POST and missing capability fail. Anonymous access to authority tables fails.
The hotel view remains unchanged. No Production migration executes.
Future token rotation must update all three verifier hashes atomically.

## Data discovered

- CRM has 4,996 profiles and 4,996 confirmed non-stale Production property references.
- Existing Production hotel view has 1,948 properties and omits 3,048 CRM IDs.
- Seventeen accepted runs use complete. Sixty accepted runs use completed.
- Current accepted recommendation evidence has 4,885 properties.
- Union with the existing historical view has 5,010 properties, including 14 additions and no CRM exclusions.
- Category evidence has 13,184 pairs, 4,272 properties and 77 destination readings.
- CRM resolves 13,153 pairs to 4,261 hotels. Eleven Yorkshire Dales properties account for 31 unresolved pairs.
- Yorkshire Dales ID: 16a08f15-3335-4d41-b710-c6f9661db249.
- Existing task cmtqm1of9000004iby1kjyici has lease expiry 08:17:45 UTC.
- Existing run cmtqm21t7000104ib3vdi00y0 reports RUNNING with heartbeat 02:19:41 UTC and 4,000 unchanged records.
- The stalled record does not prove a currently executing process. This session does not restart it.

## Problems and solutions

- Existing contraction guard lacks a baseline for the first weekly reconciliation. PR31 adds the existing confirmed-reference count.
- An initial import records fullReconciliation=false. The guard now uses the larger prior-run or current-reference baseline.
- Local PostgreSQL defaults to Australia/Sydney. Timestamp tests fail until the isolated delivery test database uses UTC.
- Production SQL initially has a variable-name ambiguity and timezone-dependent digest. Both are corrected before independent replay.
- Identity relinking initially leaves a stale Company cache link meaningful. API queries now require exact current identity agreement.
- Initial Category automation has no safe activation gate. An explicit certified-snapshot operator path now controls first activation.

## Pending items

- Production draft PR67 is pushed at the exact reviewed commit: https://github.com/ai-seeyou/tri/pull/67.
- PR67 reports the four existing baseline CI failures. The CRM function authentication audit passes. No new Category failure appears.
- Do not merge or execute its migration without the required separate exceptions.
- Complete CRM PR32 CI. Keep it draft until the Production path and live dry run pass.
- Obtain exact Production migration authority and a scoped CI exception only for independently confirmed baseline failures.
- Obtain the founder ruling for material hotel eligibility reconciliation before changing Production hotel source behavior.
- Run live full-pair Category reconciliation, apply CRM migration 67, activate the certified snapshot and verify all live acceptance checks.
- Confirm refresh behavior and token rotation across all three verifier hashes.
- Preserve existing separate issues: expired operator-role cleanup, PR66 migration filename collision, four Production baseline CI categories.
- Contact enrichment remains paused.

## Evidence

- docs/core-category-delivery-2026-09-07.md
- docs/category-local-acceptance-2026-09-07.md
- docs/hotel-refresh-containment-2026-09-07.md
- /private/tmp/crm-category-full-tests-final.log
- /private/tmp/crm-category-push.log
- /private/tmp/recommendation-environment-prompt-reconciliation.json
