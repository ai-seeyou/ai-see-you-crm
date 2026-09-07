# Governed Core Category delivery

Status: Implemented and locally reviewed. Production deployment and live certification remain blocked. Not live.

## Verification receipt

The complete CRM suite passes 1,300 tests. Monorepo type checking and focused lint checks pass.
Independent API tests cover assignments, combined dimensions, retired snapshots, stale references and identity relinking.
The local 4,996-hotel copy passes seven Category intersection checks.
See [local acceptance](./category-local-acceptance-2026-09-07.md) for counts and timing limits.

Production commit `15e67453b64772fa28bd61fbccf367f90b337560` passes independent predeployment review.
Its migration SHA-256 is `ee3d2dba6cd4fc2a35fd2834e6a08224a903bb0086f4e56f393e87b9f3b399ee`.
Fourteen Deno tests and eight actual SQL fault cases pass.
All 4,105 authority coordinates match certified evidence, including 1,095 exclusions.
Actual SQL output passes CRM validation with zero memberships and microsecond timestamps.
UTC and Sydney sessions produce identical snapshot identities.
Capability-protected GET succeeds. POST and missing capability fail. Anonymous users cannot read the authority table.
The existing hotel view remains unchanged.

The Category migration requires a separate exact founder exception before Production execution.
No hosted mutation occurs during this implementation and review work.
Production draft PR: https://github.com/ai-seeyou/tri/pull/67.
CRM draft PR: https://github.com/ai-seeyou/ai-see-you-crm/pull/32.
Production PR67 initially reports the same four failing CI categories. Its CRM authentication audit passes.
Independent comparison finds one new inventory diagnostic inside the existing failing category.
The new authority table lacks inventory classification. This regression requires correction, not a baseline waiver.
Authentication failures, fourteen advisory IDs and nine secret-scan signatures remain unchanged.
Production head `16b1d49e0f567062870221abf71ed0da16cc3923` adds the missing governed inventory classification.
The inventory correction passes independent review. The exact migration hash remains unchanged.
CI run `34085705265` tests that corrected head. No baseline exception covers a new regression.

## Separate hotel feed discrepancy

CRM retains 4,996 confirmed, non-stale imported hotel references.
The existing Production hotel view currently returns 1,948 properties and omits 3,048 existing CRM hotels.
Its operational status predicate excludes runs labelled `completed`.
Current accepted recommendation evidence contains 4,885 properties.
Its union with the existing historical view contains 5,010 properties, including 14 additions and no existing CRM exclusions.
These sets have different meanings. This change does not silently replace the approved hotel eligibility rule.
Founder authority remains necessary for the material certified-universe change.

CRM safeguard PR 31 merges at `f38ee8de6d17a2be53dd1958427c44ca2ae27a7e` after CI passes.
It rejects excessive first-reconciliation contraction against existing confirmed references before hotel mutations.
The safeguard does not change Production eligibility or Category membership.

Current Category evidence resolves to 4,261 CRM hotels and 13,153 linked pairs.
Eleven Yorkshire Dales properties remain unresolved, with 31 preserved source pairs.
Live Category activation and large-scale enrichment remain paused.

## Product flow

```text
Current
Choose Country, Destination or Hotel Group
└─ View matching Businesses, assigned Contacts or Coverage gaps

Required
Choose Country, Destination, Hotel Group and Category
├─ Businesses show current proven Category appearances
├─ Contacts match through the same qualifying assigned Business
└─ Coverage shows missing commercial roles at those qualifying Businesses
```

Category selection uses OR. Separate commercial dimensions use AND.
Saved views and URL filters retain stable Production Category identifiers.
Business Category information is read-only. Contacts have no editable Category field.
The interface reuses existing shared filters and the light visual system.

## Authority

Stage 0 independently certifies nine current core Categories and the exact accepted recommendation path.
See [Stage 0 certification](./category-authority-stage-zero-2026-09-07.md).
Group and Extended Stay remain retired. Their historical evidence remains unchanged.
The Production registry supplies names and identifiers. CRM does not define a separate taxonomy.

The current certified evidence contains 13,184 memberships across 4,272 properties and 77 destination readings.
These counts describe current Category evidence, not the separate historical 4,996-hotel import.

## Synchronisation boundary

The existing scoped GET endpoint adds a Category dataset selector.
CRM receives no Production database or service-role credential.
Production computes membership from governed prompt provenance and the latest accepted measurement per destination.
Accepted means sealed, commercially certified and non-false trend validity.
Completed jobs and resolved recommendation identities remain mandatory.
No arbitrary date window or operational run-status spelling replaces that rule.

Property modification timestamps do not describe Category additions and removals.
The agent therefore checks a content-versioned Category manifest during refresh.
An unchanged version avoids a complete download.
A changed version supplies bounded pages of complete current membership.
CRM verifies ordering, uniqueness, counts, digests and source stability before atomic activation.
A failed or partial refresh preserves the previous active snapshot.
A revision comparison prevents a delayed task from replacing a newer activation.

The membership identity uses snapshot, Production property ID and Category ID.
The CRM Company link remains nullable until exact profile and confirmed Production reference checks agree.
Unresolved links remain explicit. They never become inferred or silently discarded source memberships.
Subsequent hotel synchronisation can resolve those links without changing Production membership identity.

Only Category registry data, memberships and bounded version provenance enter CRM.
Raw recommendations, prompts, responses and citations remain excluded.
Future strength, rank or platform summaries extend this versioned membership model without editable tags.
This release does not implement those future summaries.

## Implementation anchors

- Prisma owns the Category snapshot, registry, membership and active-pointer tables.
- `production-client.ts` remains the only scoped Production HTTP transport.
- `production-category-sync.ts` owns validation, CRM writes and atomic activation in the agent.
- `production-category.ts` owns the shared boundary schemas.
- `businessDimensionFilter` combines the four dimensions for all three product surfaces.
- Contacts keep the combined Business predicate inside one active assignment predicate.
- Coverage applies the Business predicate before calculating missing roles.
- Existing search-parameter parsers, saved views and shared multi-select controls carry `categoryIds`.

## Release gates

1. Independently review the exact Production read-contract extension and privileges.
2. Confirm authority for its exact Production schema changes before execution.
3. Apply CRM migration through the normal reviewed deployment process.
4. Run focused tests, complete CI and independent adversarial review.
5. Reconcile current Production memberships with real CRM references and report every unresolved property.
6. Prove all fifteen founder acceptance checks, including complete-universe performance and idempotent refresh.
7. Activate the reviewed refresh path and verify the live interface.

The PR 66 CI exception does not apply to another Production PR.
The PR 65 migration exception does not authorise a new Production migration.
Large-scale contact enrichment remains paused until the complete feature passes live certification.

## Deployed operator path

The crm-agent deployment owns the only Category execution path.
The operator never downloads the Production URL or token.

Set `PRODUCTION_CATEGORY_SYNC_REQUEST` on crm-agent to `DRY_RUN:<new UUID>`.
Redeploy crm-agent, then wait for the durable task to finish.
The task payload stores the bounded snapshot evidence.
Each exact request queues once, including after a retry or redeployment.

Review the dry-run evidence before activation.
Set the variable to `COMMIT:<approved snapshot ID>` only after that review passes.
Redeploy crm-agent, then verify the active snapshot equals the approved identifier.
Remove the variable after the durable task completes.

The minute dispatcher creates and runs these tasks inside the deployed agent.
The payload contains no endpoint, token or database credential.
A queue failure logs a fixed error and does not stop unrelated dispatch work.
