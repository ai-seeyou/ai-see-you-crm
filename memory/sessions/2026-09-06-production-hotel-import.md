# 2026-09-06 - Production hotel import

**Project:** AI See You CRM
**Working directory:** /Users/davidwilley/Projects/CRM

## Summary

CRM contains all 4,996 certified hotels. The complete import and post-rotation idempotent rerun pass independent verification.
Production PR 65 and CRM PRs 26 and 27 are deployed. Daily incremental and weekly reconciliation schedules are enabled.
The expired temporary operator role still needs Supabase administrator removal.
Current acceptance evidence is `docs/production-hotel-import-acceptance-2026-09-06.md`.
Earlier actions and continuation entries preserve chronological history. Later founder rulings and current acceptance evidence supersede their status claims.

## Historical actions taken

- Read and verified the programme handover, foundation audit, repository rules, and area documentation.
- Fixed future relationship filtering and blocked employer move history in PR 11.
- Pushed and merged PR 11 as merge commit 07da836.
- Ratified the Production recommendation eligibility predicates against current measurement standards.
- Proved exactly 228 qualifying Sydney properties.
- Built and independently reviewed Production PR 49.
- Merged Production PR 49 as 2f48a2e.
- Deployed the Production crm-universe-read function and scoped database role.
- Initial checks incorrectly certify zero writable relations. Later cross-schema verification disproves that role-based boundary.
- Verified unauthorized GET returns 401 and authenticated POST returns 405.
- Verified authenticated Sydney GET returns 228 unique HOTEL records.
- Added the idempotent CRM import, audit records, leases, durable tasks, and weekly reconciliation.
- Added 65th CRM migration and complete import integration tests.
- Passed full tests, all type checks, builds, anti-slop, and migration drift checks.
- Committed CRM Phase 5 work as 743850e.
- Pushed Phase 5 commit 743850e and created PR 12.
- Passed two exact-commit adversarial reviews and every remote check.
- Merged PR 12 as 0f3d17d.
- Verified Vercel applied migration 65 and reported exact schema agreement.
- Confirmed no temporary CRM or Production credential file exists in /private/tmp.
- Built and independently certified the durable Sydney proving gate as commit 9490ac8.
- Removed generated Supabase link metadata after confirming it contained no source or credentials.
- Added the temporary Sydney dry-run schedule as commit 2b01a5b.
- Passed independent adversarial review for the dry-run schedule.
- Pushed branch phase-5/sydney-dry-run-trigger after founder approval.
- Created and merged PR 14 as ffd71c4.
- Added and independently certified the sanitized Sydney verifier.
- Created and merged PR 15 as 11c36f1.
- Verified the live Sydney dry run completed with 228 hotels and zero CRM writes.
- Stopped before the committed import after cross-schema Production privileges failed re-certification.
- Inventoried PUBLIC grants, consumers, routines, schemas, sequences, memberships, and role settings.
- Independent review approved only revoking PUBLIC USAGE on schema net.
- Attempted the correction twice. Both transactions rolled back fully before any change.
- Designed and reviewed a structurally read-only PostgREST RPC alternative.
- Rejected custom JWT because safe minting requires a project signing key.
- Rejected Vault HMAC because current tooling cannot store the shared secret safely.
- Approved a separate internal read capability with only its SHA-256 hash stored in PostgreSQL.
- Imported 228 Sydney hotels through the committed proving gate.
- Proved the Sydney rerun created zero records and changed zero records.
- Inventoried stable Production property fields, governed knowledge, relationships, and recommendation summaries.
- Built, reviewed, merged, and deployed Production contract v2.
- Built, reviewed, merged, and deployed CRM contract v2 synchronization.
- Applied CRM migration 66 through the production API build.
- Verified the deployed CRM schema matches Prisma.
- Verified Production contract v2 is active.
- Verified unauthenticated GET returns 401 and POST returns 405.
- Merged and deployed Production PR 63 under its one-off baseline CI exception.
- Merged CRM retry correction PR 21 and legacy task recovery PR 22.
- Recovered the legacy task and observed the bounded RPC HTTP 404 failure.
- Proved the v2 migration history existed while its objects were absent.
- Applied the exact reviewed v2 migration and verified unchanged business-table counts.
- Verified the live RPC, grants, view, triggers, GET-only behavior, and zero-write boundary.
- Proved direct PostgREST resolves the RPC while the Edge function receives a distinct internal failure.
- Merged CRM PR 23 as fc094597561d1cd74ef67907cd623d3a87efb346.
- Pushed bounded Production diagnostics to PR 64 after independent adversarial review.
- Confirmed PR 64 has only the four established baseline CI failures.
- Removed every temporary credential and probe file.

## Decisions made

- Eligible properties require complete runs, completed query jobs, active or verified entities, and accommodation type.
- QA flags, trend flags, sealed generations, and destination completion do not define recommendation validity.
- Production IDs are the only canonical match key.
- Domains never merge properties.
- Reliable Production chain identifiers map to structural CRM relationships. Names and domains never establish those relationships.
- Daily incremental refresh and weekly full reconciliation use durable AgentTask rows.
- Reconciliation confirms absences twice before marking imported property references stale.
- Diagnostic responses expose only bounded HTTP or PGRST codes and never private response details.
- The PR 63 CI exception applies only to PR 63.

## Rules learned

- CRM receives only the endpoint URL and scoped bearer token. It never receives the Production database URL.
- Production runtime uses the scoped GET-only Edge contract and guarded STABLE SECURITY DEFINER RPCs, not the rejected database-role design.
- Each RPC reads the approved view only after its GET and internal capability checks pass.
- A proving import must validate a frozen identifier manifest before CRM business writes.
- Existing unconfirmed Production references require review and remain retriable.

## Pending items

- Complete the reviewed expired operator-role removal through Supabase-managed administration.
- Observe the first future scheduled incremental run. Its implementation, watermark, and activation gate already pass verification.
- Continue commercial workflow acceptance with the complete hotel universe.
- Preserve the four unrelated Production CI baseline issues for separate remediation.

## Historical data discovered

- Production project reference: tnskqujimizlsmsmonor.
- Production PR 49: https://github.com/ai-seeyou/tri/pull/49.
- Sydney qualifying property count: 228.
- Production eligible entities before property identity filtering: 6,328.
- Production observations in completed runs and jobs: 328,928.
- CRM Phase 5 local commit: 743850e.
- Sydney dry-run trigger commit: 2b01a5b.
- Sydney dry-run result: 228 hotels, strict manifest valid, zero CRM writes, 3,129 milliseconds.
- Endpoint role made 20 observed calls with zero Production mutation shapes.
- Endpoint role inherits write access to cron and net relations through PUBLIC.
- The approved correction is REVOKE USAGE ON SCHEMA net FROM PUBLIC.
- The net schema and grant belong to supabase_admin.
- Production contract v2 commit: 0914362ae58462eadc198f6b5796f7ecc603f983.
- Production PR 62 merged as 29e3599fb1a5316b4561d11cc970224e76b94fce.
- CRM PR 18 merged as 9ffab396ad9158c15bee78b11a3668e02d7da3ef.
- CRM migration 66 is 20260906120000_production_business_profile.
- Production contract v2 is active at crm-universe-read-v2.
- Production PR 63 commit: 9abfcfd903654126f642559f7694134cd15971fb.
- CRM PR 21 merged as af7299a69abb87a0380f620d194e8f6cc725c6d8.
- CRM PR 22 recovery commit: dce3b42.
- CRM PR 23 merged as fc094597561d1cd74ef67907cd623d3a87efb346.
- Production PR 64: https://github.com/ai-seeyou/tri/pull/64.
- Production PR 64 commits: 50cfdbb and 221e6df.
- Production v2 migration SHA-256: 517bb12ade23daf6f772b55bbd369155513491b701a77ab307b2c93e25311d69.
- Verified Production counts: 10,985 entities, 336,199 observations, 81,281 query jobs, 190 runs, and 13 certifications.

## Problems and solutions

- Local PostgreSQL stopped responding. Restarted Homebrew PostgreSQL and used the guarded crm_test database.
- PR 11 test used a shared user fixture. Added an isolated owned user fixture.
- Endpoint safety review found seven blockers. Fixed every blocker and passed two independent reviews.
- Production CI includes baseline secret, inventory, and dependency failures. The new static function audit and Vercel checks pass.
- CRM import review found unsafe restart and reconciliation behavior. Added frozen manifests, leases, atomic checkpoints, and safe reconciliation.
- Remote CRM push was rejected because explicit approval is required. No remote CRM branch exists yet.
- Earlier role certification scanned only public. Cross-schema review found inherited cron and net write grants.
- Production postgres cannot revoke the supabase_admin grant or assume supabase_admin. Both correction attempts rolled back fully.
- The internal capability avoided changes to supabase_admin-owned PUBLIC grants.
- The full-universe scheduler currently reports no dry-run record.
- The next investigation must identify which durable gate returns null.
- The full-universe scheduler created one dry run and the first Production request returned HTTP 500.
- CRM PR 19 merged sanitized gate diagnostics as release commit 79438d0.
- Live diagnostics report Sydney passed, zero active runs, and one leased retry task.
- CRM PR 20 merged bounded RPC failure-header handling after independent review and complete CI.
- Production PR 63 passed independent review and its v2 function passed the auth audit.
- Production migration history falsely recorded v2 as applied. Running the reviewed migration created the missing objects.
- A schema-cache reload did not resolve the 404 because the database objects were absent.
- The Edge function still reports RPC HTTP 404 after the live RPC became available.
- PR 64 adds a bounded PGRST diagnostic to identify that internal failure.
- PR 64 fails only established terminal, secret-scan, auth-audit, and inventory checks.
- The founder limited the prior CI exception to PR 63, so PR 64 needs an exact new exception.

## Latest continuation, PR 64 approval

- Founder grants the baseline CI exception only for Production PR 64.
- Independently verify exactly four files, six focused tests, CRM authentication gate, and unchanged baseline failures.
- Merge PR 64 as 9a613a3c438d7d7c15b468469e623eee05ff39a3 and deploy crm-universe-read-v2.
- Current requests no longer fail with HTTP 404. The applied migration and schema cache now resolve the RPC.
- CRM run errors identify valid PostgreSQL timezone offsets rejected by default z.iso.datetime.
- CRM PR 24 changes only certifiedAt and evidenceSightedAt to accept valid ISO offsets.
- Thirteen focused tests and two independent reviews pass. Full CI passes.
- PR 24 merges as aba9ff24665d7c7f50bfee72c93a2a54643dc944.
- Its agent deployment crm-agent-g6cxabtkh-ai-see-you.vercel.app is READY.
- Independent pagination review proves JavaScript Date truncates PostgreSQL microseconds and repeats the last row.
- CRM PR 25 rejects repeated cursors and multi-page cycles before business writes.
- Twenty-seven integration tests, independent review, type checks, lint, and full CI pass.
- PR 25 merges as 657add99c94003e4c6863e5abb04541b00996473.
- Its agent deployment crm-agent-kpgxd5v54-ai-see-you.vercel.app is READY.
- Production PR 65 preserves exact timestamp text in opaque cursors and changes the internal RPC cursor parameter to text.
- PR 65 is https://github.com/ai-seeyou/tri/pull/65.
- Exact commit is dd75f35a6a898f7a2fae10a5d1c95a085238e02d on fix/crm-v2-cursor-precision.
- Worktree is /private/tmp/tri-crm-precision. It contains six scoped files.
- Nine focused tests and independent adversarial review pass.
- The migration replaces only the old v2 RPC signature, preserving auth, owner, STABLE, search path, grants, and the private view.
- PR 65 is not merged or deployed. Its migration is not applied.
- Comparing PR 64 and PR 65 CI yields 149 identical baseline failure signatures and zero new signatures.
- Current approved-view aggregate: 4,996 hotels, 4,996 unique IDs, zero duplicates, 76 destinations, four countries.
- Chain aggregate: 1,009 with chain, 3,987 without chain, 68 with parent chain.
- No committed full-universe import starts. The latest dry run begins 06:40:10 UTC and remains RUNNING in the last check.

## Operator verification incident

- The coordinator and child use supabase db query --linked for SELECT-only verification.
- Official CLI v2.107.0 source proves this command unnecessarily calls cli/login-role with read_only:false first.
- This creates an unused temporary operator login capability before the Management API query.
- The helper returns a temporary role, password, and server-controlled TTL. No credential appears in logs or CRM files.
- Source inspection finds the CLI role prefix cli_login_postgres. Existing consumer credentials and grants are not altered by this helper.
- This is an operator authentication mutation, not a write capability in the deployed CRM read path.
- The coordinator caused the unanticipated helper invocation. Do not claim zero operator-side Production mutations.
- Stop the default linked-query method for Production verification.
- Source-proven safer command: SUPABASE_DB_PASSWORD=unused-no-login-role supabase db query --linked --output json '<approved SELECT>'.
- The non-secret dummy skips unused login initialization. RunLinked ignores it and uses existing Management API authentication.
- A CRM-only test of that method succeeds without the login-role message.
- The child's Production pg_roles expiry query is rejected by automatic approval review before execution.
- Rejection reason: security metadata lies outside the approved CRM view.
- Do not retry that metadata query without explicit founder approval.
- Proposed query: SELECT rolname, rolvaliduntil, rolcanlogin FROM pg_catalog.pg_roles WHERE rolname = 'supabase_read_only_user' OR rolname LIKE 'cli_login_%' ORDER BY rolname.
- The specific temporary role expiry remains unknown. Do not revoke roles or broaden privileges.
- Temporary CRM diagnostic metadata lives in /private/tmp/crm-import-diagnostics. No database URL is retrieved.
- Second pass complete. This continuation preserves approvals, test evidence, deployment IDs, unexpected mutations, blocked verification, and remaining work.

## Latest continuation, PR 65 approval

- Founder explicitly approves PR 65 baseline exception, role-expiry verification, complete import after certification, incremental sync, and capability rotation.
- Reconfirm exact head dd75f35 and all six scoped files. All nine focused tests pass again.
- Existing independent review and 149-signature comparison show zero new baseline failures.
- Merge Production PR 65. Do not deploy the function because its required migration is blocked.
- Exact migration: supabase/migrations/20260906180000_crm_universe_read_cursor_precision.sql.
- SHA-256: 22ae6391a383ade2d88a354f89eb7d90626144a7ed5fa8e5dbc17392b1d0d922.
- Automatic approval review rejects the exact migration twice before execution.
- Second attempt supplies the explicit latest founder approval, reviewed commit, hash, and SELECT-only runtime purpose.
- Reviewer still rejects it under the permanent rule against Production schema migrations, regardless of user approval.
- Do not bypass the rejection through another tool, child, wrapper, or indirect execution.
- No Production migration, privilege change, or data write occurs in this continuation.
- Independent metadata audit uses the verified no-login-role command and creates no new role.
- At 06:52:59 UTC, cli_login_postgres exists with password valid until 06:39:38.77713 UTC and zero active sessions.
- It retains LOGIN, postgres membership, and effective write grants on cron.job_run_details, net._http_response, and net.http_request_queue.
- These residual privileges do not make its expired password usable. No retirement action is required under the founder's expired-role condition.
- supabase_read_only_user is a separate existing role. It has no password expiry, zero sessions, pg_monitor and pg_read_all_data memberships.
- No unrelated role is modified or removed.
- Full-universe import, certified pagination, final totals, incremental activation, and post-import rotation remain pending.

## Latest continuation, explicit migration exception

- Founder explicitly amends the permanent migration prohibition for the exact reviewed PR 65 artefact.
- Verify its unchanged SHA-256 and nine focused tests. Apply migration once and deploy v2.
- Verify one migration record, one exact v2 RPC signature, unchanged security attributes, and zero direct application view grants.
- Recover the orphan dry-run lease through guarded CRM-only metadata updates.
- Independently certify run cmtpgxcwt000004kyo3znavs6 at snapshot 2026-09-06T07:06:23.850Z.
- Prove 4,996 qualifying records, 4,996 distinct IDs, ten GET pages, 76 destinations, and four country codes.
- Country counts: AU 1321, GB 3048, NZ 408, SG 219.
- Chain counts: 1009 with chain IDs, 3987 without, 68 with parent-chain IDs.
- Production ID digest: c60eeec2202d5f586a6072b3f1e297f34487f448b26b25e4a22a8eeb2ea61439.
- Payload digest: 2149d13a10e52afa3e54fe4f83b42fb79bb69499849c04aeec3ec10297ad37da.
- Three committed attempts fail under the inherited five-second Prisma transaction timeout. Page transactions roll back completely.
- CRM PR 26 adds bounded 120-second import transactions and completed-certification gates for daily and weekly synchronisation.
- Independent review and 28 focused tests pass. Full CI passes. Merge commit: 1267cce13098fa0bb87a1b147afbeeffff9476e1.
- Deployment crm-agent-grbhl055b-ai-see-you.vercel.app reaches READY.
- Requeue certified task crm-full-381eadd7f3504d6598e83aa407dccafe. First attempt fails with Production HTTP 503 before reads.
- Independent endpoint configuration diagnosis is active. No final import certification exists yet.
- Founder requires complete incidental role retirement, not password expiry alone.
- Guarded REVOKE and guarded DROP ROLE both fail with permission errors and roll back.
- Role cli_login_postgres remains expired and inactive, with residual postgres membership and three extension write privileges.
- Complete removal requires Supabase-managed administration. This does not block the independent CRM read path.
- Prepare and independently review /private/tmp/crm-rotate-internal-capability.mjs. Do not execute before successful import.
- Rotation generates the capability in memory, replaces only two RPC verifiers, preserves metadata, and updates one scoped secret through stdin.
- Production import data writes remain zero. Approved administrative migration and failed cleanup operations are separately recorded.
- Acceptance evidence: docs/production-hotel-import-acceptance-2026-09-06.md.
- The transient 503 clears on retry without configuration changes. Deployed source and secret metadata remain correct.
- Run cmtphywow000004lcroof8bl9 commits 4500 records, creating 4293 and updating 207.
- Its final 496-record transaction expires after 125201 milliseconds against the 120000-millisecond bound.
- Current CRM contains 4521 hotel references, 4521 distinct Production IDs, and 4521 distinct businesses.
- Guarded pause changes only the unfinished task timing. Due time becomes 2026-09-06 08:41:26.172 UTC.
- Implementing child prepares branch phase-5/chunk-production-import-writes in /private/tmp/crm-enable-production-sync.
- Correction uses 100-record CRM chunks while retaining 500-record Production reads and the existing timeout bound.
- Page cursors advance only after all chunks commit. Chunk counters accrue only after successful commit.
- Parent reviews the initial three-file diff as clean. Independent review and tests continue.
- Reviewed resumption SQL: /private/tmp/crm-resume-chunked-import.sql. Execute only after the corrected deployment is READY.
- Rotation script SHA-256: 2c7ceea77f45f433db165b7d541c8f35f72434f73e8d951abb6569dfa3a25481.
- SELECT-only rotation verification: /private/tmp/crm-verify-internal-capability-rotation.sql. Substitute only the public hash output.
- PR 27 merges as f932cf65bc5a4cfc93cb40f8dc8700989348acba after independent review and all CI checks pass.
- Deployment crm-agent-kbyfvqyyo-ai-see-you.vercel.app reaches READY. Resume the exact paused task at 07:52:07.686.
- Final run cmtpikhh8000004l80jbf9wdp completes 07:53:52.488 after 91.372 seconds.
- It processes 4996 records: 475 created, 21 updated, 4500 unchanged, zero exceptions or review items.
- Independent final QA passes: 4996 confirmed active Production IDs and distinct HOTEL businesses, 4996 profiles, 76 destinations, four countries.
- All hotels have HOTEL vertical assignments. Duplicate IDs, stale refs, stale relationships, and match exceptions total zero.
- Structural links: 1009 hotel-chain relationships and three chain-parent relationships.
- Shared domains: 162 domains serve 1616 properties without collapsing their business identities.
- Execute the exact reviewed rotation script after full-import certification. Both verifier substitutions and the single scoped secret update succeed.
- New public verifier SHA-256: 80aa86ad4dd3cae988016357729bfbed6ce84f6661cbc959587000c6c072457a.
- The raw capability remains in memory and stdin only. The CRM outer token is unchanged.
- Post-rotation metadata verification and the pinned committed idempotent rerun remain pending.
- Post-rotation metadata verification passes independently for both live RPCs. Owner, ACL, STABLE, SECURITY DEFINER, GET gate, and empty search path remain unchanged.
- The old verifier is absent and the reviewed precision migration has exactly one record.
- Scoped role verification at 07:59:25.615854 again finds cli_login_postgres expired, LOGIN true, zero sessions, and postgres membership.
- Reviewed pinned idempotency SQL creates task crm-idem-2146439307e04035b85f3466b2dcffda.
- Rerun cmtpitd6k04r104l841ckrnim completes at 08:00:53.845 after 98.393 seconds.
- It verifies all 4996 hotels unchanged, with zero creates, zero updates, and zero exceptions.
- Daily incremental and weekly full reconciliation schedules are live through the reviewed completed-import gate.
- The complete import creates 4768 hotels and enriches the original 228 Sydney hotels across its committed pages.
- The recovery interval from first committed attempt to full completion is 41 minutes and 30 seconds, including fixes and deployments.
- The acceptance document and original handover now point to the later Phase 5 evidence.
- Local memory records preserve the role-cleanup requirement and the four existing Production CI baseline categories separately.
- Second pass complete. Approvals, exact artefacts, tests, deployment identifiers, failed attempts, rotation, and remaining work are recorded.
- Independent final idempotency and incremental gate certification passes. Final ID digest and all 4996 records remain unchanged.
- Import state has null cursor, snapshot, and runId. Its watermark is 2026-09-06T05:44:28.034Z.
- The first future scheduled incremental run remains an operational follow-up, not an unimplemented mechanism.
