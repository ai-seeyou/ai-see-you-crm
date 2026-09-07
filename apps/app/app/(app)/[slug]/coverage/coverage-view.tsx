"use client";

import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import {
	type DataTableFacet,
	DataTableFacetFilter,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { TableCell } from "@crm/ui/components/table";
import { TablePagination } from "@crm/ui/components/table-pagination";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { CONTACT_ROLE_OPTIONS, contactRoleLabel } from "@/lib/contact-role";
import { ENTITY_TYPE_OPTIONS, entityTypeLabel } from "@/lib/entity-type";
import { BUSINESS } from "@/lib/labels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	COVERAGE_PARAM,
	coverageInputFrom,
	coverageParsers,
} from "./coverage-search-params";
import { COVERAGE_VIEW } from "./coverage-view-config";

type Coverage = RouterOutputs["coverage"]["gaps"];
type Row = Coverage["rows"][number];

const ALL = "all";

const CELL = "px-3 py-2.5 align-middle";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "company", header: BUSINESS.one, width: "w-[26%]" },
	{
		id: "type",
		header: "Type",
		width: "w-[16%]",
		className: "hidden md:table-cell",
	},
	{
		id: "vertical",
		header: "Vertical",
		width: "w-[14%]",
		className: "hidden lg:table-cell",
	},
	{ id: "roles", header: "Roles we need" },
];

export function CoverageView() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();

	const [values, setValues] = useQueryStates(coverageParsers);

	const verticals = useQuery(
		trpc.verticals.list.queryOptions({ includeArchived: false }),
	);
	const navigation = useQuery(trpc.companies.navigation.queryOptions({}));

	const coverage = useQuery({
		...trpc.coverage.gaps.queryOptions(
			coverageInputFrom({
				vertical: values[COVERAGE_PARAM.vertical],
				entityType: values[COVERAGE_PARAM.entityType],
				covered: values[COVERAGE_PARAM.includeCovered],
				countryCodes: values[COVERAGE_PARAM.countryCodes],
				destinationIds: values[COVERAGE_PARAM.destinationIds],
				hotelGroupIds: values[COVERAGE_PARAM.hotelGroupIds],
				missingRoleTypes: values[COVERAGE_PARAM.missingRoleTypes],
				page: values[COVERAGE_PARAM.page],
				scope: values[COVERAGE_PARAM.scope],
			}),
		),
		placeholderData: (previous) => previous,
	});

	const vertical = values[COVERAGE_PARAM.vertical][0] ?? ALL;
	const entityType = values[COVERAGE_PARAM.entityType][0] ?? ALL;
	const showCovered = values[COVERAGE_PARAM.includeCovered];
	const facetData = navigation.data;
	const selectedByFacet = {
		[COVERAGE_PARAM.countryCodes]: values[COVERAGE_PARAM.countryCodes],
		[COVERAGE_PARAM.destinationIds]: values[COVERAGE_PARAM.destinationIds],
		[COVERAGE_PARAM.hotelGroupIds]: values[COVERAGE_PARAM.hotelGroupIds],
		[COVERAGE_PARAM.missingRoleTypes]: values[COVERAGE_PARAM.missingRoleTypes],
	};
	const featuredFacets = [
		{
			id: COVERAGE_PARAM.countryCodes,
			label: "Country",
			options: (facetData?.countries ?? []).map((country) => ({
				value: country.code,
				label: country.label,
			})),
		},
		{
			id: COVERAGE_PARAM.destinationIds,
			label: "Destination",
			searchable: true,
			options: (facetData?.destinations ?? []).map((destination) => ({
				value: destination.id,
				label: destination.name,
			})),
		},
		{
			id: COVERAGE_PARAM.hotelGroupIds,
			label: "Hotel group",
			searchable: true,
			options: (facetData?.hotelGroups ?? []).map((group) => ({
				value: group.id,
				label: group.name,
			})),
		},
		{
			id: COVERAGE_PARAM.missingRoleTypes,
			label: "Missing role",
			options: CONTACT_ROLE_OPTIONS,
		},
	] satisfies (DataTableFacet & { id: keyof typeof selectedByFacet })[];

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center gap-2">
				<Select
					value={values[COVERAGE_PARAM.scope]}
					onValueChange={(scope) =>
						void setValues({
							[COVERAGE_PARAM.scope]: scope === "targets" ? "targets" : "all",
							[COVERAGE_PARAM.page]: 1,
						})
					}
				>
					<SelectTrigger size="sm" aria-label="Business scope">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectGroup>
							<SelectItem value="all">All hotels</SelectItem>
							<SelectItem value="targets">Target businesses</SelectItem>
						</SelectGroup>
					</SelectContent>
				</Select>
				<Select
					value={vertical}
					onValueChange={(next) =>
						void setValues({
							[COVERAGE_PARAM.vertical]: next === ALL ? [] : [next],
							[COVERAGE_PARAM.page]: 1,
						})
					}
				>
					<SelectTrigger size="sm" aria-label="Vertical">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Every vertical</SelectItem>
						{(verticals.data ?? []).map((option) => (
							<SelectItem key={option.id} value={option.id}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={entityType}
					onValueChange={(next) =>
						void setValues({
							[COVERAGE_PARAM.entityType]: next === ALL ? [] : [next],
							[COVERAGE_PARAM.page]: 1,
						})
					}
				>
					<SelectTrigger size="sm" aria-label="Type">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Every type</SelectItem>
						{ENTITY_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					spacing={0}
					value={showCovered ? "all" : "gaps"}
					onValueChange={(next) => {
						if (next === "") return;
						void setValues({
							[COVERAGE_PARAM.includeCovered]: next === "all",
							[COVERAGE_PARAM.page]: 1,
						});
					}}
					aria-label="Which businesses to show"
				>
					<ToggleGroupItem value="gaps">Gaps only</ToggleGroupItem>
					<ToggleGroupItem value="all">
						{values[COVERAGE_PARAM.scope] === "all"
							? "All hotels"
							: "All targets"}
					</ToggleGroupItem>
				</ToggleGroup>

				{featuredFacets.map((facet) => (
					<DataTableFacetFilter
						key={facet.id}
						facet={facet}
						selected={selectedByFacet[facet.id] ?? []}
						onChange={(selected) =>
							void setValues({
								[facet.id]: selected,
								[COVERAGE_PARAM.page]: 1,
							})
						}
					/>
				))}
			</div>

			{coverage.isError ? (
				<Card className="min-w-0">
					<CardHeader>
						<CardTitle>Coverage is unavailable</CardTitle>
						<CardDescription>
							The current filters remain selected. Try loading coverage again.
						</CardDescription>
					</CardHeader>
					<CardPanel>
						<Button variant="outline" onClick={() => void coverage.refetch()}>
							Try again
						</Button>
					</CardPanel>
				</Card>
			) : !coverage.data ? (
				<div className="flex flex-1 justify-center py-12">
					<Spinner />
				</div>
			) : !coverage.data.configured ? (
				<NotConfigured coverage={coverage.data} />
			) : (
				<CoverageResults
					data={coverage.data}
					loading={coverage.isFetching}
					scope={values[COVERAGE_PARAM.scope]}
					onOpen={(id) => openRecord({ kind: "company", id })}
					onPageChange={(page) =>
						void setValues({ [COVERAGE_PARAM.page]: page })
					}
					onGroupSelect={(groupId) =>
						void setValues({
							[COVERAGE_PARAM.hotelGroupIds]: [groupId],
							[COVERAGE_PARAM.page]: 1,
						})
					}
				/>
			)}
		</div>
	);
}

function CoverageResults({
	data,
	loading,
	scope,
	onOpen,
	onPageChange,
	onGroupSelect,
}: {
	data: Coverage;
	loading: boolean;
	scope: "all" | "targets";
	onOpen: (id: string) => void;
	onPageChange: (page: number) => void;
	onGroupSelect: (groupId: string) => void;
}) {
	return (
		<>
			<Card className="min-w-0" aria-busy={loading}>
				<CardHeader>
					<CardTitle>
						<span className="flex items-center gap-2">
							{loading ? <Spinner /> : null}
							{`${data.summary.gaps} of ${data.summary.targets} ${scope === "all" ? "hotels" : "target businesses"} have a gap`}
						</span>
					</CardTitle>
					<CardDescription>
						{`${data.summary.covered} ${data.summary.covered === 1 ? BUSINESS.oneLower : BUSINESS.manyLower} ${data.summary.covered === 1 ? "has" : "have"} no gaps for this check. A filled dot names a mapped contact.`}
					</CardDescription>
				</CardHeader>
				<CardPanel>
					{data.rows.length === 0 ? (
						<CardPanelEmpty>
							{data.summary.targets === 0
								? "No businesses match these coverage filters."
								: "No businesses are missing the selected roles."}
						</CardPanelEmpty>
					) : (
						<SimpleTable variant="panel" surface="page" columns={COLUMNS}>
							{data.rows.map((row) => (
								<CoverageRow
									key={row.id}
									row={row}
									onOpen={() => onOpen(row.id)}
								/>
							))}
						</SimpleTable>
					)}
				</CardPanel>
			</Card>

			<TablePagination
				page={data.page}
				totalPages={Math.max(1, Math.ceil(data.total / data.pageSize))}
				pageSize={data.pageSize}
				total={data.total}
				loading={loading}
				onPageChange={onPageChange}
			/>

			{data.groupGaps.length > 0 ? (
				<GroupGapOverview rows={data.groupGaps} onSelect={onGroupSelect} />
			) : null}
		</>
	);
}

function GroupGapOverview({
	rows,
	onSelect,
}: {
	rows: Coverage["groupGaps"];
	onSelect: (groupId: string) => void;
}) {
	const visibleRows = rows.slice(0, COVERAGE_VIEW.groupOverviewLimit);
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>Hotel group gaps</CardTitle>
				<CardDescription>
					{`The ${visibleRows.length} groups with most gaps in the current hotel scope. Counts use only proven Production relationships. A hotel appears in both its hotel group and parent hotel group.`}
				</CardDescription>
			</CardHeader>
			<CardPanel>
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{visibleRows.map((row) => (
						<Button
							key={row.groupId}
							variant="outline"
							className="h-auto min-w-0 items-start justify-start p-4 text-left"
							onClick={() => onSelect(row.groupId)}
						>
							<div className="min-w-0">
								<div className="font-medium">{row.groupName}</div>
								<div className="mt-1 text-muted-foreground text-sm">
									{`${row.gapCount} of ${row.hotelCount} hotels have a gap`}
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{Object.entries(row.missingByRole).map(([role, count]) => (
										<Badge key={role} variant="secondary">
											{`${CONTACT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role}: ${count}`}
										</Badge>
									))}
								</div>
							</div>
						</Button>
					))}
				</div>
			</CardPanel>
		</Card>
	);
}

function CoverageRow({ row, onOpen }: { row: Row; onOpen: () => void }) {
	return (
		<SimpleTableRow clickable onClick={onOpen}>
			<TableCell className={`${CELL} truncate pl-4 font-medium`}>
				<span className="flex min-w-0 items-center gap-2">
					<EntityLogo
						src={row.iconUrl}
						darkSrc={row.iconDarkUrl}
						tone={row.iconTone as EntityLogoTone | null | undefined}
						name={row.name}
						size="sm"
					/>
					<span className="truncate">{row.name}</span>
				</span>
			</TableCell>
			<TableCell
				className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
			>
				{entityTypeLabel(row.entityType)}
			</TableCell>
			<TableCell
				className={`${CELL} hidden truncate text-muted-foreground lg:table-cell`}
			>
				{row.vertical ? row.vertical.label : <EmptyCellValue />}
			</TableCell>
			<TableCell className={`${CELL} pr-4`}>
				<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
					{row.roles.map((role) => (
						<RoleDot key={role.roleType} role={role} />
					))}
				</span>
			</TableCell>
		</SimpleTableRow>
	);
}

function RoleDot({ role }: { role: Row["roles"][number] }) {
	const holders = role.holders.map((holder) => holder.name).join(", ");

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<StatusIndicator
					size="sm"
					tone={role.filled ? "success" : "warning"}
					label={contactRoleLabel(role.roleType)}
				/>
			</TooltipTrigger>
			<TooltipContent>
				{role.filled ? holders : "Nobody in this role yet"}
			</TooltipContent>
		</Tooltip>
	);
}

function NotConfigured({ coverage }: { coverage: Coverage }) {
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>Coverage does not know what a target is</CardTitle>
				<CardDescription>
					{`Coverage reads the "${coverage.targetFieldKey}" field and treats ${coverage.targetLabels.join(" or ")} as a target. No field by that name is in use, so there is nothing to check.`}
				</CardDescription>
			</CardHeader>
			<CardPanel>
				<CardPanelEmpty>
					{`Open a ${BUSINESS.oneLower}, use the cog beside Details, and create a Lifecycle stage select field with a ${coverage.targetLabels[0] ?? "Target"} option. Coverage fills itself in once businesses carry it.`}
				</CardPanelEmpty>
			</CardPanel>
		</Card>
	);
}
