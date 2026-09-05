"use client";

import Add from "@carbon/icons-react/es/Add";
import ChartRelationship from "@carbon/icons-react/es/ChartRelationship";
import Close from "@carbon/icons-react/es/Close";
import { RelationshipType } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	EntityLogo,
	type EntityLogoTone,
} from "@crm/ui/components/entity-logo";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { SimpleTable, SimpleTableRow } from "@crm/ui/components/simple-table";
import { TableCell } from "@crm/ui/components/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@crm/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import { DetailSheetEmpty } from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import { entityTypeLabel } from "@/lib/entity-type";
import { BUSINESS } from "@/lib/labels";
import {
	RELATIONSHIP_TYPE_OPTIONS,
	relationshipLabel,
} from "@/lib/relationship-type";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { QuickAddForm } from "./quick-add";
import { AddRow } from "./record-parts";
import { useOpenRecord } from "./record-stack";

type Company = RouterOutputs["companies"]["byId"];
type Edge = Company["relationships"]["outgoing"][number];

const ADD_LABEL = "Add relationship";

const COLUMNS = [
	{ id: "type", header: "Relationship", width: "w-[24%]", className: "pl-5" },
	{ id: "company", header: BUSINESS.one, width: "w-[32%]" },
	{ id: "kind", header: "Type", width: "w-[18%]" },
	{ id: "since", header: "Since", width: "w-[16%]" },
	{ id: "end", srLabel: "End relationship", width: "w-10" },
];

export function CompanyRelationships({
	company,
	adding,
	onAdd,
	onDone,
}: {
	company: Company;
	adding: boolean;
	onAdd: () => void;
	onDone: () => void;
}) {
	const edges = [
		...company.relationships.outgoing,
		...company.relationships.incoming,
	];

	const form = adding ? (
		<AddRelationship company={company} onDone={onDone} />
	) : null;

	if (edges.length === 0) {
		return (
			<>
				{form}
				{adding ? null : (
					<DetailSheetEmpty
						icon={ChartRelationship}
						title="No relationships recorded"
						description={`Say what ${company.name} belongs to, who manages it, and which properties sit under it. A group and its hotels are separate ${BUSINESS.manyLower} joined by a relationship.`}
						action={
							<Button variant="outline" size="sm" onClick={onAdd}>
								<Icon icon={Add} data-icon="inline-start" />
								{ADD_LABEL}
							</Button>
						}
					/>
				)}
			</>
		);
	}

	return (
		<>
			{form}
			<SimpleTable variant="panel" columns={COLUMNS}>
				{edges.map((edge) => (
					<RelationshipRow key={edge.id} companyId={company.id} edge={edge} />
				))}

				<AddRow label={ADD_LABEL} columns={COLUMNS.length} onClick={onAdd} />
			</SimpleTable>
		</>
	);
}

function RelationshipRow({
	companyId,
	edge,
}: {
	companyId: string;
	edge: Edge;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const end = useMutation(
		trpc.relationships.end.mutationOptions({
			onSuccess: async () => {
				await cache.relationship(companyId, edge.company.id);
				toast.success("Relationship ended.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<SimpleTableRow
			clickable
			onClick={() => openRecord({ kind: "company", id: edge.company.id })}
		>
			<TableCell className="truncate py-2.5 pr-3 pl-5 font-medium">
				{relationshipLabel(edge.type, edge.direction)}
			</TableCell>
			<TableCell className="truncate px-3 py-2.5">
				<span className="flex min-w-0 items-center gap-2">
					<EntityLogo
						src={edge.company.iconUrl}
						darkSrc={edge.company.iconDarkUrl}
						tone={edge.company.iconTone as EntityLogoTone | null | undefined}
						name={edge.company.name}
						size="sm"
					/>
					<span className="truncate">{edge.company.name}</span>
				</span>
			</TableCell>
			<TableCell className="truncate px-3 py-2.5 text-muted-foreground">
				{entityTypeLabel(edge.company.entityType)}
			</TableCell>
			<TableCell className="px-3 py-2.5 text-muted-foreground">
				{edge.validFrom ? (
					<LocalDay date={edge.validFrom} />
				) : (
					<EmptyCellValue />
				)}
			</TableCell>
			<TableCell className="w-10 py-2.5 pr-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-xs"
							disabled={end.isPending}
							onClick={(event) => {
								event.stopPropagation();
								end.mutate({ id: edge.id });
							}}
						>
							<Icon icon={Close} />
							<span className="sr-only">End this relationship</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>End this relationship</TooltipContent>
				</Tooltip>
			</TableCell>
		</SimpleTableRow>
	);
}

function AddRelationship({
	company,
	onDone,
}: {
	company: Company;
	onDone: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [type, setType] = useState<RelationshipType>(
		RelationshipType.BELONGS_TO,
	);
	const [toCompanyId, setToCompanyId] = useState("");

	const typeId = useId();
	const companyId = useId();

	const create = useMutation(
		trpc.relationships.create.mutationOptions({
			onSuccess: async (edge) => {
				await cache.relationship(edge.fromCompanyId, edge.toCompanyId);
				toast.success("Relationship recorded.");
				onDone();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<QuickAddForm
			submitLabel={ADD_LABEL}
			pending={create.isPending}
			ready={toCompanyId !== ""}
			onCancel={onDone}
			onSubmit={() =>
				create.mutate({
					fromCompanyId: company.id,
					toCompanyId,
					type,
				})
			}
		>
			<Field>
				<FieldLabel htmlFor={typeId}>{company.name} is</FieldLabel>
				<Select
					value={type}
					onValueChange={(next) => setType(next as RelationshipType)}
				>
					<SelectTrigger id={typeId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{RELATIONSHIP_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</Field>
			<Field>
				<FieldLabel htmlFor={companyId}>{BUSINESS.one}</FieldLabel>
				<CompanyPicker
					id={companyId}
					value={toCompanyId}
					onValueChange={setToCompanyId}
				/>
			</Field>
		</QuickAddForm>
	);
}
