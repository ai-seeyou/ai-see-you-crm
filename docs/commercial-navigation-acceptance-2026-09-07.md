# Commercial navigation acceptance

Date: 2026-09-07.

## Scope

Country, Destination, and Hotel group become first-class navigation dimensions.
Businesses display these columns and support combined filters and saved views.
Contacts derive these filters from current Business assignments.
Coverage uses the complete imported hotel universe by default.
Contact enrichment remains paused during acceptance.

This change adds no database migration, Production access, credential, or enrichment operation.
Production-owned values remain synchronised and read-only from CRM.

## Semantics

- Country filters use canonical country codes. GB displays as United Kingdom.
- Destination filters use Production destination identifiers, not names.
- Hotel group filters use CRM identifiers linked to confirmed, current Production references.
- Parent groups include properties of proven child groups.
- Group traversal excludes stale, unconfirmed, expired, future, and archived group paths.
- Ungrouped means no current governed group relationship. It does not establish independent ownership.
- Multiple values within one dimension use OR. Different dimensions use AND.
- Contact dimensions must match the same assigned Business.
- Group employment alone does not establish responsibility for the group's properties.
- Current EMPLOYER and RESPONSIBLE_FOR assignments provide the contact filter path.
- Archived contacts and archived assigned Businesses do not establish current coverage.
- Coverage defaults to All hotels. Target businesses remains an explicit optional scope.
- A selected missing role controls the gap count and group ranking.
- Multiple missing roles match a Business missing at least one selected role.
- Parent and child group totals overlap. Do not add those totals together.

## Real-data oracle

Independent CRM-only SELECT checks establish these counts.

| Scope | Hotels |
| --- | ---: |
| Complete imported universe | 4,996 |
| Australia | 1,321 |
| United Kingdom | 3,048 |
| New Zealand | 408 |
| Singapore | 219 |
| Australia and Sydney | 228 |
| Accor, including proven child groups | 218 |
| Sydney and Accor | 43 |

The universe spans 76 destinations and 144 governed hotel groups.
Accor spans 17 destinations.
The graph contains 1,009 hotel-group edges and three child-parent edges.
The live CRM contains zero Contacts and zero ContactAssignments during this check.

## Independent service verification

An isolated local database contains the complete CRM identity and relationship dataset.
The copy contains no credentials, correspondence, or personal contact data.
Its export SHA-256 is `5691588876b0448de06e2f72c9faebe75faa728e1ef072e7cc339df12a77692e`.

Actual API services run against that copy.
The checks compare returned counts with the independent live-data oracle.
The checks validate complete facets, output schemas, and combined missing-COMMERCIAL filters.

Synthetic contacts test responsibility semantics inside a rollback transaction.
They use real copied hotel identities, not invented hotel structure.
These checks do not claim verification against real people.

Verified cases include:

1. A group employee with explicit Sydney property assignments matches Sydney.
2. A contact with Sydney and Auckland assignments matches both destinations.
3. A Sydney Hilton and Auckland Accor contact does not match Sydney plus Accor.
4. A group employee without property assignments does not match Sydney.
5. Ended and future assignments do not establish current responsibility.
   Archived contacts and archived assigned Businesses also remain excluded.
6. Two covered Sydney Accor properties reduce missing-COMMERCIAL results from 43 to 41.
7. The rollback restores zero Contacts and zero ContactAssignments.

## Verification state

The parent runs repository type checks, lint, anti-slop lint, and the full regression suite.
The full suite passes after the parent aligns the isolated database timezone with CI's UTC setting.
The initial timezone mismatch changes no application or hosted database configuration.

Independent API and interface code review passes.
The review validates actual service output schemas against the complete identity copy.
Country and Hotel group sorting pass both directions, alphabetical boundaries, and repeated-page stability.
The six interface tests validate URL state, saved-view application, default columns, and named filter controls.
The application deployment build passes.
PR 29 merges after CI and all preview deployments pass.
The reviewed implementation commit is `9aac22dff6725381dcee439218a2c991a8165906`.
The release merge commit is `c6848aa2f098fbecb85c711c1f195701c0a92919`.
Release CI also passes.
The app, API, and agent deployments all reach READY on this merge commit.
The live navigation endpoint returns HTTP 401 without authentication.
The live application redirects unauthenticated visitors to sign-in.
PR 30 adds the previously omitted noindex/nofollow metadata and all-route response header.
Independent review and focused source tests pass for this bounded safeguard.
Its final live header and rendered-metadata verification resides in the PR 30 release receipt.
The in-app browser reports no available browser backend.
Authenticated visual and keyboard checks remain unverified.

## Evidence files

Temporary operator evidence resides outside the repository:

- `/private/tmp/crm-navigation-real-identities.json`
- `/private/tmp/crm-navigation-performance.sql`
- `/private/tmp/crm-navigation-scale-results.json`
- `/private/tmp/crm-navigation-contact-results.json`
- `/private/tmp/crm-navigation-full-test-utc.log`

The independent SQL oracle completes the combined Sydney Accor missing-COMMERCIAL query in 5.643 milliseconds.
Initial local service checks complete warm requests in approximately 9 to 40 milliseconds.
Full-universe Country and Hotel group sorting completes in 46 to 82 milliseconds locally.
Coverage checks complete in 44 to 254 milliseconds during concurrent local regression testing.
These measurements exclude hosted network and browser rendering time.

## Issues

1. NOT DONE. Authenticated browser verification has no available browser backend.
   Fix: Open the signed-in CRM in the in-app browser, then verify filters, saved views, sorting, and keyboard navigation.
2. RISK. Country and Hotel group sorting load matching row data before server-side pagination.
   Fix: Current scale checks pass. Repeat performance checks as the hotel universe grows.
3. RISK. Local transaction tests emit an existing PostgreSQL client concurrency deprecation warning.
   Fix: Review adapter compatibility before upgrading the PostgreSQL client to version 9.
