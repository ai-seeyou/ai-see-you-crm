# Category release execution

Status: Deployment and live certification in progress. Enrichment remains paused.

## Founder authority

The founder approves exact Production PR67 migration execution and its independently matched baseline CI exception.
The founder also approves correcting hotel-feed eligibility while preserving all 4,996 existing hotel references.
Each candidate addition requires independent recommendation evidence and identity deduplication.
The release includes CRM PR32 deployment and live Businesses, Contacts and Coverage verification.
No CRM Production database credential, service-role credential or Production write capability is authorised.

## Production Category deployment

Reviewed head: `16b1d49e0f567062870221abf71ed0da16cc3923`.
Merge commit: `8794e43ca2459b055f6c13ea8f06e22adf200625`.
Migration SHA-256: `ee3d2dba6cd4fc2a35fd2834e6a08224a903bb0086f4e56f393e87b9f3b399ee`.
Function deployment: `crm-universe-read-v2`, ACTIVE version 6.
Bundle SHA-256: `56bda5d5c8746b65b6f989d512e4ff6501e9c8c28cd06091e2574ae12ec7ea97`.

Independent postdeployment review confirms the exact function and all 4,105 authority coordinates.
All 13,184 Category pairs match independent calculation across 4,272 properties and 77 destinations.
Six measurement identifier/status fingerprints match preflight.
These fingerprints prove equality only for their checked fields, not every warehouse column.
Scoped permissions deny direct authority-table access and add no CRM Production write capability.
The approved migration writes its new authority registry. CRM writes no Production data.

## Migration ledger issue

The direct governed SQL execution does not automatically register Supabase migration history.
Version `20260907230000` remains absent from the ledger after successful object creation.
The exact guarded bookkeeping SQL passes independent review.
Bookkeeping SHA-256: `1ee295861898398b11449c1ad971921c8c49195adf817b45336b068b428920db`.
The tool guard rejects this metadata write as outside the exact migration artefact approval.
No retry through another route occurs. No migration re-execution or history overwrite occurs.
Do not execute migration 20260907230000 again. Resolve its ledger registration separately.

## CRM task recovery

Task: `cmtqm1of9000004iby1kjyici`.
Run: `cmtqm21t7000104ib3vdi00y0`.
The run stalls at 4,000 unchanged hotels with zero created or updated hotels.
Its heartbeat remains `2026-09-07 02:19:41.297`.
Recovery SQL SHA-256: `27738ae3ba03bd9de776a16bb6322ce91f09ee3cf5c04fc77e5a9ed7cdbd4751`.
Independent review proves exact-row guards and atomic worker fencing.
The run becomes FAILED and the task finishes. Existing hotel and reference rows remain untouched.
Existing import state and its cursor remain preserved. Do not restart the old task.

Before and after recovery, all 4,996 confirmed hotel references remain current.
Their ordered Production-ID-to-Company-ID MD5 stays `9c8ddc6115dbea655206878caac6a658`.
The complete baseline mapping is `/private/tmp/crm-category-existing-4996-refs.json`.

## Candidate evidence

Independent review proves all fourteen candidate identities individually.
All are active accommodation businesses in Yorkshire Dales, GB.
Each has completed query-job recommendation observations joined by both job ID and run ID.
Accepted Pulse: `7f910a96-8c9e-4809-9697-a53506e8db31`.
Run: `355d7227-6965-4aaa-b197-8a63817195fb`.
The Pulse is sealed and commercially certified. Its run status is `completed`.
The deployed corrected-feed set comparison and CRM deduplication pass before committed additions.
The independent candidate query is `/private/tmp/hotel-candidate-14-independent.sql`.

## Hotel-feed correction review

Production PR68: https://github.com/ai-seeyou/tri/pull/68.
Exact head: `be2432c470a379bf948687460f32e77c242fe4c9`.
Migration SHA-256: `a6bfb25210d274f2348e076fb38404eef83b7ec0591ee367263c41c9e480d87f`.
The sole eligibility change accepts both canonical terminal spellings, `complete` and `completed`.
The correction preserves the original historical recommendation rule. It does not substitute latest-Pulse membership.
Independent evaluation of the exact replaced view returns 5,010 unique IDs.
This set retains all 4,996 existing IDs and adds exactly the fourteen individually proven Yorkshire IDs.
There are zero missing or unexpected IDs, 77 destinations and four countries.
ID SHA-256: `37928f110ade40f5dd3c3e0ed7682687c1ed7b0859052a66aa4bf3eb2c26cdeb`.
Nine local tests preserve view columns, permissions, owner, object identity, security barrier and source rows.
Strict deployment guards and exact rollback tests pass.
The coordinator merges and deploys PR68 after the founder's subsequent direction to proceed.
Merge commit: `bfca2bb7e7e7a8c89f0a9c3e167f39bd2ba76a79`.
Independent CI comparison confirms no new or removed signatures against baseline run `34081221780`.
PR68 run `34087928777` matches authentication 3/3, advisories 14/14, inventory 118/118 and secret findings 9/9.
Independent postdeployment verification confirms the exact 5,010-property set before committed hotel reconciliation.

## Hotel reconciliation receipts

Full dry-run task: `crm-hotel-5010-dry-14e249866ea84b149425b417d07b125d`.
Run: `cmtqwxt5o000004icq35im377`.
Snapshot: `2026-09-07T07:22:24.917Z`.
Payload SHA-256: `18d0b71a25a589131fe03bf612606f454e3c49ce50c9210d327fdc7e4c8c3931`.
The run reads 5,010 properties through eleven GET requests in approximately sixteen seconds.
Independent reconstruction matches every property ID and the complete payload digest.

The coordinator imports only the fourteen additions through the reviewed destination workflow.
This avoids unnecessary writes to the existing 4,996 hotels.
Executed queue SHA-256: `2f2cf57bec6766751ba4493b78f06b759ee0d69c37a3006bbdfb8531ded39019`.
Task: `crm-yorkshire-14-28adc7b6346d47ea94e38acf3c259b25`.
The task finishes at `2026-09-07T07:31:12.126Z`, with fourteen created and zero updated hotels.
All 4,996 existing identity mappings remain unchanged. CRM now holds 5,010 confirmed hotel references.

An independently reviewed rerun pins both fourteen-property digests and the same snapshot.
Queue SHA-256: `36f183c3f88f368ee26e8776c89fbb25dea353e7da75ce0f492bb203196487ff`.
Task: `crm-yorkshire-14-idem-d6b54f7545484dc9b6c2f4fb22f9d4e8`.
The rerun finishes at `2026-09-07T07:36:12.716Z` with zero created, zero updated and fourteen unchanged hotels.
All 4,272 Category properties now resolve to CRM hotels.

## Deployed CRM operator

Commit `93e6151` adds the independently reviewed durable Category operator task.
Only crm-agent holds the scoped read token. No local process retrieves it.
A bounded environment request queues a dry run or activation of an explicitly approved snapshot.
The dispatcher persists bounded evidence and reuses completed evidence on retries.
Initial Category activation remains off without an explicit request.
The complete CRM suite now passes 1,308 tests.
The first full check catches a missing API label for the new task kind.
Commit `10114dd` adds the label. The normal push hook and all remote CI/preview checks then pass.
The writing review preserves the existing task-label style. No new UI component or branding appears.

CRM PR32 is merged at `c8d0d9beba9b92c785d447423a6802fbe7d43e90`.
The app, API and agent Production deployments all reach READY at that exact commit.
The API deployment applies CRM migration 67 exactly once. All 67 migrations finish; none remain unfinished.
The deployed migration checksum matches `b381e2ade6343462286be7f65581e16362e376dfe05ed534c1ea761d219442f2`.
Category dry-run task: `crm-category-dry-4b4bc8601cb14ea9869188b5c2e5c428`.
The coordinator queues this CRM-only task without retrieving the Production token.
Activation remains pending its completed evidence and independent certification.

## Category source failure

Independent reconstruction identifies duplicate certification joins in the Category RPC.
The direct certification-record join expands 77 destination readings into 214 rows.
The RPC rejects these duplicates through its authority-completeness check before returning a snapshot.
Independent recommendation calculation still proves 13,184 memberships across 4,272 properties.
The correction must aggregate commercial certification records without hiding genuinely ambiguous destination runs.
The existing terminal-read certificate metadata selection uses the latest commercial certification timestamp per Pulse.
The coordinator prepares a separately reviewed correction. No new Production migration executes under the PR67-only exception.

The CRM dispatcher also loses errors for tasks without a Business or Contact owner.
Therefore an unfinished task without an outcome does not prove that its request still runs.
A narrow CRM correction adds bounded request cancellation and saved, sanitised task failure outcomes.
The missing request timeout is a separate reliability defect, not the proven source failure.
CRM PR33 contains the runtime correction at `6bf4bea4fb0fb8ccff77fcd6d71cf0eabeab97cc`.
Independent review passes fourteen focused tests. The full normal push hook passes all 1,311 repository tests.

The failed dry task finishes at `2026-09-07T07:49:18.803Z` through independently reviewed, exact-task fencing.
Fence SQL SHA-256: `4ec586440758e66be0ce38fc5c8f1d9a6fc822480b67afe85f1e7d6a1c99cdf6`.
The fence preserves its payload, records the proven failure and stops repeated failed reads.
It changes no hotel or Category record. Late dry-run evidence cannot pass its unfinished-task guard.

Read-only correction simulation preserves all 77 selected runs and all 13,184 memberships.
The corrected payload passes actual CRM schema, ordering and digest validation.
Expected corrected snapshot: `54795ad01a12590eb549b840b015372fc7cc9bff1af154610dcfb1b3d27d055e`.

The exact correction migration passes independent local forward, full RPC and rollback tests.
Migration SHA-256: `e0f6ab1a603f9b5a0edccdf282c1f252bbda2edd7edae50f78ca14d3b4bc02ae`.
Rollback SHA-256: `fad389b0487ee380d9b9639b5da58372e96933df78fa9edc1e2f597abe27f0bd`.
Repeated certificates select one latest timestamp. Genuine competing latest runs still fail closed.
Anonymous bounded GET succeeds with the correct synthetic capability. POST and missing capability fail.
Function permissions, identity, owner and execution settings remain unchanged.
The metadata guard compares semantic argument defaults, not PostgreSQL parser source offsets.
The initial exact test catches that offset-only difference before any hosted execution.
Repeated forward migration and rollback both fail closed.
No correction migration executes in Production at this stage.

Production correction PR: https://github.com/ai-seeyou/tri/pull/70.
Reviewed source head: `1a29cae8527e5bdc4c11f297730b739513086d87`.
The repository includes the exact RPC regression harness and synthetic fixtures.
The harness discards inherited PostgreSQL settings and fixes both host and host-address to loopback.
Its independent run passes and removes its own test database.
CRM PR33 merges at `621ce420137f1f0abc5f0c4cf5506c70a8391e1c` after all current CI and previews pass.
All three CRM production deployments reach READY at that exact merge commit.
PR70 final CI run `34098895378` matches baseline `34094855243` with zero new or removed failure signatures.
Counts remain authentication 3, advisories 14, inventory 118 and secret findings 9.
The exact PR67-only migration and CI exception does not cover PR70.
PR70 remains unmerged and undeployed pending its required separate exception.
After deployment, queue a new Category dry run and certify its completed evidence before activation.

## Execution after PR70 approval

The founder approves PR70's exact migration and unchanged-baseline CI exception.
PR70 merges at `8c74ab04a445b31ac5afa5d425abfeae553e13b9`.
The coordinator executes the exact `e0f6ab1a` migration once through the approved Production operator.
Independent postflight confirms source `c2d1d4f52c6aee3ec404f12df23b0e3558fe85933c39786ae262cf5e9a84215d`.
All 77 selected runs, 13,184 memberships and 4,105 authority coordinates remain unchanged.
Function identity, owner, permissions and read-only execution settings remain unchanged.

Fresh dry-run task: `crm-category-dry-fd157501afea4d46829a36e486169cfc`.
Request: `3cf20d64-fdce-4df0-a3d7-a56a6495377a`.
Its first attempts expose a separate obsolete capability verifier in the Category function.
Both hotel functions already use the rotated public verifier `80aa86ad4dd3cae988016357729bfbed6ce84f6661cbc959587000c6c072457a`.
The Category function incorrectly retains the retired `50f5de0e` verifier from the historical migration.
The earlier review misses cross-function verifier parity. This is an implementation and certification defect.

The coordinator completes the previously approved internal capability rotation through a separately reviewed, bounded verifier alignment.
Operational SQL SHA-256: `de2e31c76374d8624847b8c4a397a879630ec9408697d6f5d64b232311d40a52`.
Only the Category verifier changes. No new credential, permission or measurement change occurs.
No credential is retrieved or printed. Both hotel functions remain byte-identical.
Live Category source becomes `919b171df140390537f27fe1aa27561499c0bb428eff8a33f0b7d4ccf9bc1bbb`.
Independent postflight proves all three verifier hashes match the current rotated capability.
The old PR70 rollback correctly rejects this rotated source. Future rollback must preserve the current verifier.
Never restore the retired verifier from historical migration SQL.
The dry task exhausts three attempts at `2026-09-07T08:48:32.747Z` without completed evidence.
Category remains inactive. No activation task is queued.
Independent deployed Edge bundle verification matches all six reviewed runtime files exactly.
The Category router exists in the deployed bundle. A stale Edge deployment does not explain the remaining failure.
The Category error path collapses the upstream failure into `RPC_UNKNOWN`.
Read-only HTTP and database metadata diagnosis continues before another dry run.
The anonymous database role has a three-second statement timeout.
Combined snapshot and full membership reconstruction takes 5,571.901 milliseconds.
Exact snapshot fragments, including the authority guard, pass at 2,815.559 milliseconds.
Exact first, middle and terminal page fragments each exceed three seconds with SQLSTATE `57014`.
First-page work completes in 5,868.458 milliseconds without that limit. It returns 501 rows and the expected snapshot.
The exact replay includes the authority guard, full digests and bounded page calculation.
Unknown authority coordinates and ambiguous destinations both remain zero.
This proves a page-query budget defect. Direct hosted HTTP error details remain unavailable.
No timeout, permission or additional Production schema change occurs during diagnosis.
Tool policy blocks proposed trace-based credential recovery and separate function-statistics access.
Neither blocked operation is retried through another route.
The final CRM read verifies 5,010 references, 5,010 unique properties and 5,010 unique businesses.
The Category state remains at revision zero with no active snapshot.
Independent EXPLAIN attributes the cost to repeated pair computation and deduplication, not JIT compilation.
A blanket-materialization candidate exceeds ten seconds and is rejected without deployment.
No speculative performance correction changes Production.

## Reviewed performance correction

Production commit `6b3e16f` contains the independently reviewed single-graph correction and bounded RPC error handling.
Forward migration SHA-256: `388d7922d7ad53ce01204d0a564dd35147c090ba0570eeb2070f419bcdfe470e`.
Rollback SHA-256: `2d03454d9a467385bc1ac1366f37d86d772c75a2cb1008c23cef0cf3fa9551d9`.
Regression test SHA-256: `ed185c6fe8be7384f4d2dc242b1d1ccf27bb9c2f4086924ec8c97bebddf96e41`.
All 28 cursor replays pass the unchanged three-second statement limit, with unchanged digests and membership fields.
The complete sequence covers every page, the final 184 records and an empty request after the last record.
Exact migration replay also validates the snapshot, final-nine and empty responses through the actual handler and CRM schemas.
The slowest independently measured snapshot leaves 168 milliseconds of headroom. The deployed complete dry run remains mandatory.
Local regression tests pass both exact source baselines, current verifier preservation, metadata, rollback and repeated-execution rejection.
Anonymous GET succeeds. POST, missing capability and wrong capability fail.
Twelve independent graph fault cases preserve the original semantics.
The parent independently reruns the complete local regression and seven bounded RPC error tests successfully.
The parent rejects an unreachable duplicate query branch during review. The final function contains one graph and no dead fallback.
No performance migration or related Edge correction deploys at this stage.
The exact new migration and unchanged-baseline CI exception require separate founder authority from PR70.

CRM task outcomes now have a separately reviewed, pending change to retain only allowlisted HTTP and RPC status codes.
Arbitrary errors, private suffixes and unrecognised SQLSTATE values retain the generic classification.
Retry, lease and completed-outcome protection remain unchanged. No raw response body or credential is stored.

## Browser gate

The Browser skill initialises successfully but finds no connected browser.
Browser discovery returns an empty list. No alternate browser or cookie-store access occurs.
A non-blocking request asks the founder to open and sign into the CRM in Codex's browser.
Live browser certification remains required. Database and local tests do not replace it.
