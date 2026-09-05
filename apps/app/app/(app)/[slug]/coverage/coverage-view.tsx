"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import {
	Select,
	SelectContent,
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
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { contactRoleLabel } from "@/lib/contact-role";
import { ENTITY_TYPE_OPTIONS, entityTypeLabel } from "@/lib/entity-type";
import { BUSINESS } from "@/lib/labels";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import {
	COVERAGE_PARAM,
	coverageInputFrom,
	coverageParsers,
} from "./coverage-search-params";

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

	const coverage = useQuery({
		...trpc.coverage.gaps.queryOptions(
			coverageInputFrom({
				vertical: values[COVERAGE_PARAM.vertical],
				entityType: values[COVERAGE_PARAM.entityType],
				covered: values[COVERAGE_PARAM.includeCovered],
			}),
		),
		placeholderData: (previous) => previous,
	});

	const data = coverage.data;

	if (!data) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	if (!data.configured) {
		return <NotConfigured coverage={data} />;
	}

	const vertical = values[COVERAGE_PARAM.vertical][0] ?? ALL;
	const entityType = values[COVERAGE_PARAM.entityType][0] ?? ALL;
	const showCovered = values[COVERAGE_PARAM.includeCovered];

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center gap-2">
				<Select
					value={vertical}
					onValueChange={(next) =>
						void setValues({
							[COVERAGE_PARAM.vertical]: next === ALL ? [] : [next],
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
						});
					}}
					aria-label="Which targets to show"
				>
					<ToggleGroupItem value="gaps">Gaps only</ToggleGroupItem>
					<ToggleGroupItem value="all">All targets</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<Card className="min-w-0">
				<CardHeader>
					<CardTitle>
						{`${data.summary.gaps} of ${data.summary.targets} targets have a gap`}
					</CardTitle>
					<CardDescription>
						{`${data.summary.covered} target ${data.summary.covered === 1 ? BUSINESS.oneLower : BUSINESS.manyLower} have every role we need. A filled dot is a person we can name.`}
						{data.truncated
							? ` Checked the first ${data.examined} of ${data.summary.targets}. The rest are not counted here yet.`
							: ""}
					</CardDescription>
				</CardHeader>
				<CardPanel>
					{data.rows.length === 0 ? (
						<CardPanelEmpty>
							{showCovered
								? "No target matches this filter."
								: "Every target has the people we need."}
						</CardPanelEmpty>
					) : (
						<SimpleTable variant="panel" surface="page" columns={COLUMNS}>
							{data.rows.map((row) => (
								<CoverageRow
									key={row.id}
									row={row}
									onOpen={() => openRecord({ kind: "company", id: row.id })}
								/>
							))}
						</SimpleTable>
					)}
				</CardPanel>
			</Card>
		</div>
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
