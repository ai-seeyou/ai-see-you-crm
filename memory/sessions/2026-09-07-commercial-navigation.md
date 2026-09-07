# 2026-09-07: Commercial navigation

Project: AI See You CRM.
Working directory: `/Users/davidwilley/Projects/CRM`.

## Summary

The founder prioritises Country, Destination, and Hotel Group navigation before large-scale contact enrichment.
PR 29 implements these dimensions across Businesses, Contacts, and Coverage.
Independent code, actual service, complete-universe data, sorting, and synthetic responsibility checks pass.
The live deployment succeeds. Browser interaction remains unverified because no in-app browser backend is available.

## Actions taken

- Read startup memory, repository instructions, README, CLAUDE, full handover, and full foundation audit.
- Read API, design, and setup area documents before work.
- Verify clean release at `cefd714777900abf0242069c6852d7fece082f44`, remote state, merged PRs, and live deployment state.
- Create `fix/commercial-navigation` for the implementation.
- Delegate backend work to `full_gate_diagnosis` and interface work to `production_field_inventory`.
- Delegate independent CRM inventory and adversarial acceptance to `rotation_review`.
- Preserve separate implementation and certification responsibilities.
- Add visible Business columns, persistent multiselect dimensions, meaningful sorting, and shared featured filter controls.
- Add Contact filtering through current assignments to the same Business.
- Add complete Coverage counts, selected-role filtering, pagination, all-hotels scope, and governed group-gap ranking.
- Add a shared authenticated navigation query and cache invalidation.
- Add integration and interface-state tests.
- Export CRM identity and graph fields through CRM-only SELECT queries for local acceptance.
- Use the existing CLI dummy-password path to avoid creating another temporary login role.
- Create an isolated loopback-only PostgreSQL cluster at `/private/tmp/crm-navigation-pg.EVpUDz`, port 55435.
- Apply all 66 CRM migrations only to local `_test` databases.
- Use `crm_navigation_test` for regression tests and `crm_navigation_scale_test` for independent full-copy acceptance.
- Run actual API services against 4,996 copied hotel identities and 144 governed groups.
- Run synthetic contact tests inside rollback transactions. Restore zero local contacts and assignments afterwards.
- Run repository type checks, lint, anti-slop lint, full tests, and the application build.
- Push through normal hooks without bypasses. Create PR 29 and record exact-commit independent review.
- Merge PR 29 after CI and all preview checks pass.
- Verify app, API, and agent deployments reach READY on the merge commit.
- Verify the new `/api/trpc/companies.navigation` endpoint rejects unauthenticated requests with HTTP 401.
- Verify the app redirects unauthenticated visitors to `/sign-in`.
- Discover the inherited public sign-in page lacks noindex metadata and headers.
- Start a bounded follow-up for the permanent noindex/nofollow ruling and final acceptance documentation.

## Decisions made

- Use Production destination IDs and governed group references, not names or domains, for structural navigation.
- Country codes remain canonical. GB displays as United Kingdom.
- Parent groups include proven child-group hotels, with deduplicated property counts.
- Ungrouped means no current governed group relationship, not evidence of independent ownership.
- Multiple selections in one dimension use OR. Dimensions combine with AND.
- Contact geography and group filters match one active assigned Business.
- Group employment alone does not establish hotel responsibility.
- Preserve manual businesses and archived Business views. Exclude archived businesses from current contact responsibility and Coverage.
- Default Coverage to All hotels because imported hotels contain no lifecycle Target values.
- Preserve Target businesses as an explicit optional scope. Do not manufacture Target labels.
- A selected missing role controls Coverage counts and group-gap ranking.
- Multiple missing roles select businesses missing at least one selected role.
- Keep parent and child group count overlap visible in interface copy.
- Keep server-side label sorting for the current universe. It passes full-scale performance checks without a schema migration.
- Do not create fake hosted contacts. Label local contact fixtures as synthetic.
- Keep contact enrichment paused until browser interaction checks pass.

## Rules learned

- Preserve all founder privacy, model selection, outbound email, and Production write boundaries.
- The navigation task requires no Production call, credential, migration, privilege change, or hosted data mutation.
- PostgreSQL test clusters must use UTC to match CI and timestamp-sensitive inherited tests.
- The local Supabase CLI SELECT path requires the nonsecret dummy password to avoid temporary-role creation.
- The browser skill prohibits replacing an unavailable backend with unrelated browser automation or hidden authentication access.
- Review must test same-property Contact combinations, not separate matching assignments.
- Saved-view tests should exercise the real apply helper. Do not add identity wrappers solely to make tests appear stronger.

## Data discovered

- Complete universe: 4,996 hotels, 76 destinations, four countries.
- AU: 1,321. GB: 3,048. NZ: 408. SG: 219.
- Sydney: 228 hotels. Production destination ID: `272e832a-c91e-4bd4-bf17-4f048f22d42c`.
- Accor: 218 hotels across 17 destinations, including 43 Sydney hotels.
- Accor includes 215 direct hotels and three Ennismore hotels through the governed parent relationship.
- CRM holds 144 governed groups, 1,009 hotel-group edges, and three child-parent edges.
- All inspected current group and relationship references are confirmed and non-stale.
- Live CRM contains zero Contacts, zero ContactAssignments, and zero custom field values during acceptance.
- CRM project reference: `oobfqkcqcdsbcnapegyk`.
- Identity export SHA-256: `5691588876b0448de06e2f72c9faebe75faa728e1ef072e7cc339df12a77692e`.
- Independent SQL combined-filter oracle: 5.643 milliseconds execution time.
- Exact-commit local sorting: 40 to 58 milliseconds. Exact-commit Coverage: 32 to 40 milliseconds.
- These timings exclude hosted network and browser rendering time.
- Implementation commit: `9aac22dff6725381dcee439218a2c991a8165906`.
- PR: `https://github.com/ai-seeyou/ai-see-you-crm/pull/29`.
- Merge commit: `c6848aa2f098fbecb85c711c1f195701c0a92919`.
- Independent review comment: `https://github.com/ai-seeyou/ai-see-you-crm/pull/29#issuecomment-5563739733`.
- Passing PR CI run: `34073127855`. Passing release CI run: `34073297361`.
- Live app deployment: `crm-15t9kixhi-ai-see-you.vercel.app`.
- Live API deployment: `crm-grcqd7y40-ai-see-you.vercel.app`.
- Live agent deployment: `crm-agent-qpnw4mm2r-ai-see-you.vercel.app`.

## Problems and solutions

- Coverage originally requires Target labels and stops after 200 records. The new scope and pagination cover all imported hotels.
- Initial draft helpers hide manual and archived businesses. Review restores caller-owned archive filtering.
- Initial group traversal admits invalid paths and duplicate ancestors. Governed target checks and visited sets correct those paths.
- Initial Ungrouped logic counts relationships to ungoverned targets. Final predicates restrict targets to governed groups.
- Initial Coverage ignores explicitly selected roles outside default hotel roles. Final evaluation includes selected roles.
- Initial group rankings ignore the selected missing role. Final rankings use the same role filter as the results.
- Initial sort uses relation count and country codes. Final sort uses display labels before pagination with stable identifiers.
- Initial filter controls disappear in empty or unconfigured states. Final controls remain available with clear retry and empty states.
- Initial Coverage copy overstates completeness for selected-role checks. Final copy describes only the current check.
- Two anti-slop errors appear in final checks. Narrow typing and optional-property changes remove them without suppressions.
- Local PostgreSQL initialization needs sandbox escalation for shared memory. The cluster remains loopback-only and separate from hosted databases.
- The first full suite fails an unchanged keyless-brand timestamp test. Australia/Sydney database timezone causes the mismatch.
- Set only the local regression database timezone to UTC. The full suite then passes without application changes.
- The browser runtime lists zero available browsers. Ask asynchronously for a signed-in in-app browser and continue all other work.
- A first API probe uses `/trpc` and returns 404. The observed configured path is `/api/trpc`; its unauthenticated response is 401.
- Public sign-in indexing exclusion is absent before this follow-up. Apply noindex/nofollow without modifying authentication.

## Pending items

- Complete live browser selection, filtering, multiselect, saved-view restoration, sorting, pagination, and keyboard checks.
- Do not claim synthetic responsibility tests verify real people. No real contacts exist yet.
- Keep large-scale enrichment paused until the remaining interaction acceptance passes.
- Finish and independently verify the narrow indexing-exclusion follow-up.
- Monitor full-row sorting as the universe grows.
- Review the existing PostgreSQL client concurrency deprecation warning before upgrading that client to version 9.
- Preserve the separately documented expired Production operator-role cleanup item. This session does not touch Production privileges.
- Preserve existing Production baseline CI categories and all model/privacy/outbound-email founder gates.

## Evidence and recovery

The acceptance document is `docs/commercial-navigation-acceptance-2026-09-07.md`.
Temporary evidence and reproducible local harnesses remain under `/private/tmp`:

- `crm-navigation-real-identities.json`
- `crm-navigation-performance.sql`
- `crm-navigation-scale.ts`
- `crm-navigation-scale-results.json`
- `crm-navigation-contact-acceptance.ts`
- `crm-navigation-contact-results.json`
- `crm-navigation-full-test-utc.log`
- `crm-navigation-push.log`
- `crm-navigation-app-build.log`

No credential file is retrieved or created for this navigation work.
The existing import and capability rotation evidence remains in the 2026-09-06 session record.
Second pass complete. The timezone correction, browser limitation, and indexing omission are included above.
