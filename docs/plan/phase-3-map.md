# Phase 3 implementation map

Produced by a read-only reconnaissance pass over the repository on 5 September 2026,
against branch `phase-2/travel-data-architecture`. Schema line numbers move as Phase 2
migrations land: re-grep `packages/db/prisma/schema.prisma` before trusting any line
number that points into it. Everything else was read directly.

## 1. User-facing language

There is no i18n, no locale file, no label module. Strings are inline. The one
precedent for a copy module is `apps/app/components/crm/fields/fields-copy.ts`: a flat
file of exported constants plus `satisfies Record<RecordKind, string>` maps. Copy that
pattern.

`packages/ui` contains zero occurrences of company, companies, deal or deals in any
casing. The relabel is entirely inside `apps/app`, plus about thirty API error and
activity-subject strings.

### Display strings that change

Navigation and pages:
- `apps/app/components/app-icon-rail.tsx:52,59` titles (the `href` on those lines stays)
- `apps/app/app/(app)/[slug]/companies/page.tsx:21,31,32`
- `apps/app/app/(app)/[slug]/deals/page.tsx:21,31,32`

Tables:
- `companies-table.tsx:44,106,248,285`
- `deals-table.tsx:37,45,233,252,274`
- `contacts-table.tsx:82,210,215,219,269`
- `dashboard-summary.tsx:49,73,79,137,143,277`
- `sales-dashboard.tsx:96,147,163`

Record sheets:
- `company-sheet.tsx:93,113,193,222,281,465,587,591,636`
- `contact-sheet.tsx:77,124,158,219,390,600`
- `deal-sheet.tsx:174,477,557`

Create sheets and pickers:
- `create-company-sheet.tsx:99,100`
- `create-deal-sheet.tsx:118,119,157`
- `create-contact-sheet.tsx:170,175`
- `company-picker.tsx:24,81,82,120,127,161`
- `contacts-bulk-actions.tsx:172,182`

Stage and status:
- `apps/app/lib/deal-stage.ts:19` `PRESENTATION`, the only place stage labels live
- `stage-change.tsx:138,150`

Other:
- `fields-copy.ts:7,9,65,67,71,73,77,79,95,97`
- `standard-fields.ts:22,30`
- `quick-switcher.tsx:25,73,77`
- `apps/app/lib/agent-record.ts:43,44,56,57`
- `apps/app/lib/agent-transcript.ts:61,62,75,76,79`
- `record-actions.tsx:37` the `NOUN` map
- `settings/research-key.tsx:55`, `settings/connections/page.tsx:121,133`,
  `google-connection.tsx:52,56`, `microsoft-connection.tsx:43`, `slack/page.tsx:48`,
  `currencies/currency-settings.tsx:51,164,304,316`

Do NOT relabel `(landing)/onboarding/page.tsx:19`, `onboarding-form.tsx:63` or
`grant-access/page.tsx:16,18,22`. Those say company meaning our own company, not a CRM
record.

API strings that reach the user as toasts, because `DomainErrorMiddleware` maps
`HttpException` messages straight to the client:
- `apps/api/src/companies/companies.contracts.ts:21`
- `apps/api/src/companies/companies.service.ts:614,730`
- `apps/api/src/deals/deals.contracts.ts:45,46,47,94,118`
- `apps/api/src/deals/deals.service.ts:500,645,666,704,846`
- `apps/api/src/activities/activities.contracts.ts:68`, `activities.service.ts:224`
- `apps/api/src/conversations/conversations.contracts.ts:54`, `conversations.service.ts:941`
- Activity-log subject strings: `companies.service.ts:309,385,404,420,491,524`,
  `deals.service.ts:300,381,397,452,570,631,649,682`, `company-directory.service.ts:54`,
  `mailbox-match.service.ts:187,195`, `enrichment/enrichment-copy.ts:12`

### Identifiers that must NOT change

- Route segments `/companies` and `/deals`, and `proxy.ts:20` `SECTIONS`,
  `section-prefetch.ts:10`, `lib/record-href.ts:5`, `record-actions.tsx:44`
  `RECORD_PROCEDURES`, `record-stack.ts:25` `FORM_TAB`, `field-editor.tsx:74`.
- The `RecordKind` union at `record-stack.ts:13`. It is serialised into
  `?record=company:<id>` and parsed at `record-stack.ts:44`. Changing it invalidates
  every bookmarked URL.
- tRPC router aliases `@Router({ alias: "companies" })` at `companies.router.ts:35` and
  `"deals"` in `deals.router.ts`. They generate `apps/api/src/generated/server.ts`.
- Every `restMeta` path in `companies.router.ts:45` to `:181` and in `deals.router.ts`.
  That is the Clay-facing door.
- Prisma model and table names, and `@@map("company")`, `@@map("deal")`.
- `FieldEntity` = COMPANY, CONTACT, DEAL, consumed by `FieldDefinition.entity`,
  `SavedView.entity`, `fields-entity.ts:3`, `cache.ts:14` `ENTITY_FOR`.
- Query-param keys in `lib/search-param-keys.ts`, and every facet id. Facet ids are
  persisted into `SavedView.filters` JSON at `use-table-query.ts:154`. Renaming one
  silently breaks every saved view.
- Agent bridge headers `x-crm-company` and `x-crm-deal` in `lib/agent-record.ts:41,54`
  and `app/eve/v1/[...path]/route.ts:47,48,54,55`.

### The label module

One new file, `apps/app/lib/labels.ts`, modelled on `fields-copy.ts`:

```
RECORD_LABEL: Record<RecordKind, { one: string; many: string }>
  company -> { one: "Business",    many: "Businesses" }
  contact -> { one: "Contact",     many: "Contacts" }
  deal    -> { one: "Opportunity", many: "Opportunities" }
```

Plus `recordLabel(kind)` and `recordLabelPlural(kind)`, and the composed strings that
appear more than once. Sentence prose stays where it is and reads its noun from
`recordLabel`. `lib/` and not `components/crm/`, because it must be importable from
server pages and client components without a cycle. It must import nothing from
`@crm/db` except `@crm/db/enums`, which is hand-flagged client-safe.

Leave the API strings inline. A constants module in `apps/api` for thirty literals
fights the additive, file-local rule.

## 2. Routes and pages

Under `apps/app/app/(app)/[slug]/`:

| Route | File | Kind |
| --- | --- | --- |
| Overview | `page.tsx` | server, renders client `dashboard-summary.tsx` |
| Company list | `companies/page.tsx` | server, prefetches `companies.list` and `users.list` |
| Company table | `companies/companies-table.tsx` | client |
| Company deep link | `companies/[companyId]/page.tsx` | server, redirects to `?record=company:<id>` |
| Contacts | `contacts/page.tsx`, `contacts-table.tsx` | server, client |
| Deals | `deals/page.tsx`, `deals-table.tsx` | server, client |

There is no deal board. `deals-table.tsx` is a `DataTable`. `StageStepper` is the only
stage-progression widget and it lives inside the deal sheet.

Record sheets are not routes. They are URL state. `RecordSheetHost` is mounted once in
`app/(app)/[slug]/layout.tsx:32` and reads the `?record=` stack, so any page can open
any sheet.

### Where TODAY and COVERAGE go

Two directories, `today/` and `coverage/`, each a server `page.tsx` plus a client
component. Copy `companies/page.tsx` exactly: `PageShell`, `PageShellHeader`,
`Suspense`, an async child that calls `requireSession()`, then
`queryClient.prefetchQuery(...)`, then `HydrateClient`.

Four files make them reachable:
1. `apps/app/components/app-icon-rail.tsx:42` add two `RailItem`s. Icons come from
   `@carbon/icons-react/es/*`, see the imports at lines 3 to 8. This file is the whole
   navigation, desktop rail and mobile sheet both.
2. `apps/app/proxy.ts:20` add the two paths to `SECTIONS`, or the slug rewrite does not
   treat them as app sections.
3. `apps/app/components/crm/section-prefetch.ts:10` extend the `Section` union and add
   two case arms at `:18`, else hover prefetch is a no-op.
4. `AppIconRailFallback` at `app-icon-rail.tsx:187` iterates the same `ITEMS` array, so
   it picks the new items up with no change.

## 3. Record sheet anatomy

1. `layout.tsx:31` mounts `<RecordSheetHost />`.
2. `record-sheet-host.tsx` reads `useRecordStack()`, holds the top ref in local state to
   survive the close animation, renders `<DetailSheet>` containing one of
   `CompanySheet`, `ContactSheet`, `DealSheet`, keyed by `recordKey`.
3. Each sheet runs one `useQuery(trpc.<x>.byId...)`, builds a `DetailSheetTab[]`, and
   hands it to `RecordSheetFrame`.
4. `apps/app/components/crm/record-sheet/record-parts.tsx:19` `RecordSheetFrame` renders
   header, loading and error, stats, then tabs.
5. `apps/app/components/detail-sheet.tsx:172` defines `DetailSheetTab` and
   `DetailSheetTabs`. A tab is `{ value, label, count?, content, keepMounted? }`.
   `keepMounted` is set only on the Agent tab, which `docs/agent-panel.md` requires.

A panel does not fetch. The `byId` query is the sole source. `CompanyContacts` and
`CompanyDeals` take `company: RouterOutputs["companies"]["byId"]` and read
`company.contacts` and `company.deals` off it. The payload shape is fixed by
`companyDetailOutput` in `apps/api/src/companies/companies.contracts.ts:176`.

Mutations invalidate through `useCrmCache()`, for example `cache.company(id)` at
`company-sheet.tsx:444`. Never a hand-written query key. `docs/api.md` makes that
mandatory.

### Adding a panel, the smallest correct way

1. `apps/api/src/companies/companies.contracts.ts` add the output object schemas beside
   `companyDetailContactOutput` at `:146`, then add the arrays to `companyDetailOutput`
   at `:176`.
2. `apps/api/src/companies/companies.service.ts` `byId` starts at `:151`. Extend the
   select with `relationsFrom`, `relationsTo` and `assignments`.
3. Run `bun run --filter=api trpc:generate`. `apps/api/src/generated/server.ts` is
   generated AND committed. The build never regenerates it. If the app cannot see a new
   procedure, the generator has not run.
4. New files under `apps/app/components/crm/record-sheet/`, or new functions beside
   `CompanyContacts` at `company-sheet.tsx:427` and `CompanyDeals` at `:557`. Use
   `SimpleTable variant="panel"`, `SimpleTableRow`, `TableCell`, `AddRow`, exactly the
   `CompanyDeals` shape at `:600`. Empty state is `DetailSheetEmpty` with a Carbon icon.
5. `company-sheet.tsx:171` insert the `DetailSheetTab` entries. Do not set `keepMounted`.
6. New write procedures go in new routers, then their invalidation keys go into
   `cache.company()` at `apps/app/lib/trpc/cache.ts:166`.
7. An inline add form follows `AttachDealContact` at
   `apps/app/components/crm/record-sheet/quick-add.tsx:155`, and registers a value in
   `RECORD_FORMS` and `FORM_TAB` at `record-stack.ts:19`.

The contact Responsible-for panel is identical against `contacts.contracts.ts`,
`ContactsService.byId`, and the tabs array at `contact-sheet.tsx:113`.

## 4. Filters and tables, end to end

1. `companies/companies-search-params.ts:3` calls `createListSearchParams({ facetIds })`.
2. `apps/app/components/data-table/list-search-params.ts:89`. Each facet id gets
   `parseAsNativeArrayOf(parseAsString)` at `:112`. `:102` calls
   `assertUnreservedSearchParamKeys`, so a facet id colliding with `SEARCH_PARAM` throws
   at module load. `toInput` at `:130` produces the tRPC input.
3. `apps/app/components/data-table/use-table-query.ts:64`. `useQueryStates(parsers)` at
   `:70`. Facet selections become `query.filters` at `:88`. Custom fields are namespaced
   `field:<key>` at `:23` and `:94`. `setFilter` at `:122` branches on that prefix.
4. `companies/page.tsx:57` loads the same params server side and prefetches with the same
   input, so hydration matches.
5. `apps/api/src/companies/companies.contracts.ts:8` `companyListInput`. Base `listInput`
   is `apps/api/src/trpc/list-input.ts:3`.
6. `apps/api/src/companies/companies.service.ts:642` `buildWhere` builds an `AND: []` from
   search, archived, `this.fields.fieldFilters(...)`, owner, then one push per facet.
7. `companies.service.ts:672` `facetCounts` runs a `groupBy` per facet against a where
   holding only search and archived, so counts do not collapse under a filter.
8. `companies-table.tsx:200` builds `DataTableFacet[]` and spreads `...fieldFacets` last.

Custom-field filters already work end to end:
- `apps/api/src/fields/fields.service.ts:493` `filterableFieldsFor`, only SELECT and USER,
  only `showOnFilter: true`, only unarchived.
- `:514` `filterFacetCounts`, groups `FieldValue` by `fieldId` and `optionId`.
- `:582` `fieldFilters`, emits `{ fieldValues: { some: { fieldId, optionId: { in } } } }`.
- `apps/app/components/crm/fields/field-facets.tsx:13` `useFieldFacets`, emits the facet
  id `field:<key>`.
- Definitions seeded at `packages/db/prisma/seed.ts:493` `seedCompanyFields`.

| Filter | Backing | Work |
| --- | --- | --- |
| Lifecycle stage | FieldDefinition SELECT | none, set `showOnFilter: true` on the seed |
| Region | FieldDefinition SELECT | none, same |
| Vertical | `Company.verticalId` column | full pipeline |
| Entity type | `Company.entityType` enum | full pipeline |
| Role type | `ContactAssignment.roleType` | full pipeline, and it is a relation filter |

Vertical and entity type, exactly:
1. `companies-search-params.ts:6` add the facet ids.
2. `companies.contracts.ts:8` add the array inputs, and add the columns to
   `companyRowOutput` at `:116` and `companyDetailOutput` at `:176`.
3. `companies.service.ts:642` two more pushes. The `enrichment` case at `:658` is the
   enum cast precedent.
4. `companies.service.ts:672` two more `groupBy` calls. `verticalId` returns ids, so
   either join `Vertical` in the service or add a `verticals.list` procedure and map
   client side.
5. `companies.service.ts` list select at `:96` and the row mapper at `:150`.
6. Regenerate `apps/api/src/generated/server.ts`.
7. `companies-table.tsx:200` two more `DataTableFacet` entries.

Role type on contacts is the same shape, but the Prisma clause is
`{ assignments: { some: { roleType: { in: [...] }, validTo: null } } }` and the count is
a `contactAssignment.groupBy`, scoped the way `fields.service.ts:540` scopes its own.

Saved-view hazard: `SavedView.filters` at `schema.prisma` stores facet ids verbatim.
Adding ids is safe. Renaming or removing one is not. `applyView` at
`use-table-query.ts:156` clears every known facet then reapplies, so an unknown key ends
up in the URL as a stray param and is silently ignored.

## 5. tRPC surface

| Router | File | Why |
| --- | --- | --- |
| companies | `companies/companies.router.ts` | facets, relationships and assignments in byId |
| contacts | `contacts/contacts.router.ts` | role facet, responsible-for in byId |
| deals | `deals/deals.router.ts` | stale opportunity read |
| activities | `activities/activities.router.ts` | overdue tasks beyond `myTasks` |
| dashboard | `dashboard/dashboard.router.ts` | the precedent to copy |
| new: relationships | `relationships/` | EntityRelationship CRUD |
| new: assignments | `assignments/` | ContactAssignment CRUD |
| new: today, coverage | `today/`, `coverage/` | the two views |
| new: verticals | `verticals/` | picker options and facet labels |

Copy `apps/api/src/dashboard/` verbatim. It is four files and a 31 line router, and it is
a read-only aggregate, which is exactly what TODAY and COVERAGE are.

- `dashboard.router.ts:13` `@Router({ alias: "dashboard" })` then `@UseMiddlewares(AuthMiddleware)`
  ON THE CLASS. Per `docs/api.md`, no `AuthMiddleware` means public and there is no other
  guard. The only class-level omission in the codebase is `sso`, which applies it per method.
- `:20` `@Query({ input, output, meta: restMeta("GET", "/dashboard/summary", ["Dashboard"]) })`.
  Input and output are zod schemas from a sibling `*.contracts.ts`.
- `:25` `@Ctx() ctx: AuthedTrpcContext` and `@Input() input`. The body delegates to the service.
- `dashboard.module.ts` then registration in `apps/api/src/app.module.ts:41`.
- Write procedures: `deals.router.ts:128` (`attachContact`, `detachContact`,
  `setContactRole`) is the join-table template, and `deals.service.ts:610` is the service
  half, including the invariant enforced in the service and not only in the picker.
- Client side, add invalidation to `apps/app/lib/trpc/cache.ts`, `listKeys()` at `:74` and
  `activityKeys()` at `:68`. Never a key list at the call site.

## 6. What TODAY can answer today

| Need | Backing | State |
| --- | --- | --- |
| Overdue task | `Activity` with `type = TASK`, `completedAt = null`, `dueAt < now`, owner `createdById` | exists. `ActivitiesService.myTasks` at `activities.service.ts:190` with `window: "overdue"`. `DashboardService` also does it inline at `dashboard.service.ts:135`, capped at 10. |
| Reply since yesterday | `EmailMessage.direction = INBOUND` with `sentAt >= cutoff`, linked through `EmailThread.companyId` and `.contactId` | data exists, no procedure. There is no `ActivityType.REPLY`. **`EmailMessage.sentAt` has no standalone index**, so a global inbound scan is a sequential scan. Query through `EmailThread.lastMessageAt`, which is indexed by company and by contact. |
| Stale opportunity | `Deal.stageChangedAt`, `Deal.lastActivityAt` (indexed), `Deal.expectedCloseDate` (indexed), `OPEN_DEAL_STAGES` | data exists, staleness is undefined. There is no threshold constant anywhere. |
| Follow-up due | same as overdue, `dueAt >= now` | exists, `myTasks` `window: "upcoming"` |

Not represented at all:
- A required commercial role per entity type. `ContactRoleType` has no matrix. Put it in
  `apps/api/src/coverage/coverage-config.ts` keyed by `EntityType`, shaped like
  `apps/agent/agent/lib/dispatch-config.ts`. Not a table until it must be editable.
- A target business. Nothing marks a Company as a target. Lifecycle stage is a
  FieldDefinition SELECT, so COVERAGE must filter on `fieldValues.some(...)` and resolve
  the definition id at request time, exactly as `fields.service.ts:582` does.
- The staleness threshold. It goes in `apps/api/src/today/today-config.ts`, same pattern.

## 7. UI component inventory

In `packages/ui/src/components/`, already present and to be used:

`data-table.tsx` (`DataTableColumn:58`, `DataTableFacet:73`, `DataTableTabs:84`,
props `:104`), `simple-table.tsx` (`SimpleTable variant="panel"`, the record-sheet panel
primitive), `card-table.tsx` (`CardTable`, `CardTableEmpty`, what the overview cards use
and the right choice for TODAY), `card.tsx`, `empty.tsx` (wrapped app-side by
`DetailSheetEmpty` at `detail-sheet.tsx:359`), `tabs.tsx`, `badge.tsx` (variants at `:9`),
`status-indicator.tsx` (`StatusTone` at `:6`, how deal stage renders), `stat-card.tsx`,
`dashboard.tsx` (`DashboardGrid`, `DashboardRow`, `DashboardSection`, `ChartCard`,
`KpiCard`, `StatGroup`, exports at `:178`, this is the layout system for TODAY and
COVERAGE), plus `table.tsx`, `table-pagination.tsx`, `combobox.tsx`, `command.tsx`,
`select.tsx`, `toggle-group.tsx`, `token-field.tsx`, `sortable-list.tsx`,
`entity-logo.tsx`, `person-avatar.tsx`, `empty-cell.tsx`, `sourced-value.tsx`,
`skeleton-swap.tsx`, `spinner.tsx`, `separator.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`,
`sheet.tsx`, `dialog.tsx`, `field.tsx`, `chart.tsx`, `dashboard-chart.tsx`.

Missing, and wanted:
1. A directed typed edge display. Nothing renders one. A `SimpleTable` with a type badge
   and a direction glyph covers V1 without a new primitive.
2. A valid-from to valid-to range display, because relationships and assignments are
   temporal. `StatusIndicator` plus `LocalDay` from `apps/app/components/local-date-time.tsx`
   covers it.
3. A multi-select combobox with search, for bulk assignment. Read `combobox.tsx` and
   `token-field.tsx` before assuming a new variant is needed. If one is needed it goes
   into `packages/ui`, never a `className` at the call site.
4. A coverage matrix. Build it as a `SimpleTable` with one column per role and a dot cell
   first. Promote it to `packages/ui` only when a second caller appears.

Boundary: `detail-sheet.tsx` and `page-shell.tsx` are app-level compositions of
`packages/ui` primitives, and that is the grain. A `RelationshipsPanel` belongs in
`apps/app/components/crm/record-sheet/`. Only a new primitive or variant goes into
`packages/ui`.

## 8. Risks by file

### Company gains entityType and verticalId

1. `companies-table.tsx:41` to `:153`. The Industry column at `:74` renders
   `Company.industry`, an enrichment-derived SaaS taxonomy. For a hotel it reads
   "Hospitality" or is blank while Vertical holds the real answer. Two similar columns,
   one meaningless. Decide whether Industry survives.
2. `company-sheet.tsx:79` `pendingFields` pushes "industry" into the "Agent is
   researching" box at `detail-sheet.tsx:302`. A travel business will permanently show
   industry as a gap. Add `verticalId` and `entityType`, drop `industry`.
3. `company-sheet.tsx:226` `MetaLine`, the header subtitle, is location plus industry.
   Entity type belongs there instead.
4. `company-sheet.tsx:340` to `:408`, the Details rail. Vertical and entity type need
   `InlineSelectField` entries from `apps/app/components/crm/inline-field.tsx`, plus the
   two fields in `companyUpdateInput` at `companies.contracts.ts:28`.
5. There is no presentation map for `EntityType`. `apps/app/lib/deal-stage.ts:19` is the
   only precedent. A raw `HOTEL_GROUP` renders as `HOTEL_GROUP`. Add
   `apps/app/lib/entity-type.ts` before entity type appears anywhere.
6. `apps/api/src/search/search.router.ts:9`. `searchHitOutput.detail` is the quick
   switcher subtitle. It should become the entity type. Today it is the domain.
7. `apps/app/components/crm/fields/standard-fields.ts:3`. The COMPANY list drives the
   fields sheet's reorder-and-hide section. Vertical and entity type are real columns,
   so they must be added there or they are invisible in field management.
8. `apps/agent/agent/lib/accounts.ts` and `lookup.ts` select explicit field lists. New
   columns are simply absent from agent output until added. A gap, not a break.

### A contact has assignments at several businesses

`Contact.companyId` stays singular and stays what the UI shows. All of these keep working
and all of them show only the primary employer:
1. `contacts-table.tsx:82` `CompanyCell`. A group director covering 180 properties reads
   as one company.
2. `contact-sheet.tsx:219` the Company stat, and `:386` `InlineCompanyField`, a
   single-value editor. Editing it now means changing the primary employer assignment,
   which is not what the control says.
3. `contacts-table.tsx:206` the Company facet filters on `companyId` only. A search for
   everyone at Accor misses every property-level responsible-for contact.
4. `contacts-bulk-actions.tsx:61,181` `bulkSetCompany` rewrites `companyId` in bulk and
   leaves `ContactAssignment` untouched. Highest risk existing control.
5. `company-sheet.tsx:427` `CompanyContacts` reads the `companyId` back-relation, so the
   Contacts tab on a property is empty even when three group contacts cover it, and the
   count badge at `:181` reads 0.
6. `companies.service.ts:614` `setPrimaryContact` enforces employment against
   `Contact.companyId`, so a responsible-for contact cannot be the property's primary
   contact. The same rule exists on deals.
7. `mailbox-match.service.ts` and `company-directory.service.ts:13` file a thread against
   the contact's single `companyId`, so an email about a property lands on the group and
   the property's Activity tab stays empty.
8. `companies.service.ts:104` `_count: { contacts: true }` counts employees only.

### DealStage values replaced

`DealStage` is imported in 31 files. Order of operations: `packages/db/src/deal-stage.ts`,
then `apps/app/lib/deal-stage.ts`, then the chart colours, then `stage-stepper.tsx`, then
`stage-change.tsx`, then the seed, then the tests.

1. `apps/app/lib/deal-stage.ts:4` to `:27`. `PRESENTATION` is `Record<DealStage, ...>`, so
   a missing member is a type error. `OPEN_STAGES` at `:29` is `ORDER.slice(0, 4)`, a
   positional slice that silently changes meaning.
2. `packages/db/src/deal-stage.ts:3` to `:23`, consumed by `companies.service.ts:8`,
   `dashboard.service.ts:2`, `deals.service.ts` and the agent.
3. `apps/app/components/crm/stage-stepper.tsx:12,34,59` names `CLOSED_WON` literally three
   times and builds its rail from the open stages. With seven open stages it renders
   seven segments in a sheet rail.
4. `apps/app/components/crm/stage-change.tsx:101,150,153`. `:150` and `:153` compare to the
   bare string "CLOSED_LOST", not the enum. It typechecks and stops matching.
5. `deals-bulk-actions.tsx:36` and `create-deal-sheet.tsx:39` render every stage. Nine in
   a dropdown is fine, nine in a bulk-action submenu is not.
6. `apps/app/lib/deal-stage.ts:41` `OPEN_STAGE_COLORS` has four colours indexed by
   `OPEN_STAGES.indexOf`. Stages five onward all resolve to `var(--chart-5)` and the
   pipeline donut at `sales-dashboard.tsx:184` becomes identical slices. Needs
   `--chart-6` and `--chart-7` in `packages/ui/src/styles/globals.css`.
7. `sales-dashboard.tsx:184` links to `/deals?stage=<key>`. Existing bookmarks and
   existing `SavedView.filters` rows holding `DEMO_BOOKED` become dead filters that match
   nothing, with no error.
8. `apps/app/components/crm/timeline/timeline-entry.tsx:13` renders historical
   `STAGE_CHANGE` activities through `dealStageLabel`. Old `Activity.meta` blobs hold
   retired names, so the lookup returns undefined and the entry throws or blanks. See
   `packages/validation/src/activity-meta.ts`.
9. `apps/api/src/telemetry/rollup.service.ts` references stages. Telemetry is hard
   disabled, so this is a compile concern only.
10. `apps/agent/agent/lib/accounts.ts` and `lookup.ts` filter by stage. The agent is a
    separate deployment, so a mismatch fails at runtime, not at build time.
11. Tests naming stages: `apps/api/test/bulk.spec.ts`,
    `apps/api/test/currency-totals.integration.spec.ts`, `apps/api/test/agent-events.spec.ts`,
    `apps/app/test/agent-transcript.spec.ts:232`, five files under `apps/agent/test/`, and
    `packages/db/prisma/seed.ts`.

Grep for `=== "CLOSED` and `=== "DEMO` and any other bare stage literal before calling
the enum change done.
