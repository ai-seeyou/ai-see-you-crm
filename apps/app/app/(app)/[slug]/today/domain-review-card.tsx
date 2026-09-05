"use client";

import { EntityType } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { Field, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
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
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import { LocalRelativeTime } from "@/components/local-date-time";
import { ENTITY_TYPE_OPTIONS } from "@/lib/entity-type";
import { BUSINESS } from "@/lib/labels";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Review = RouterOutputs["domainReviews"]["list"]["rows"][number];

const CELL = "px-3 py-2.5 align-middle";

const COLUMNS: SimpleTableColumn[] = [
	{ id: "domain", header: "Domain" },
	{
		id: "reason",
		header: "Why",
		width: "w-44",
		className: "hidden md:table-cell",
	},
	{
		id: "waiting",
		header: "People waiting",
		width: "w-28",
		align: "right",
		className: "hidden sm:table-cell",
	},
	{ id: "seen", header: "Last seen", width: "w-24", align: "right" },
];

const REASON = {
	UNRECOGNISED: "Sending domain we do not know",
	AMBIGUOUS: "Domain matches more than one",
} satisfies Record<Review["reason"], string>;

function nameFromDomain(domain: string): string {
	const label = domain.split(".")[0] ?? domain;
	return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DomainReviewCard() {
	const trpc = useTRPC();
	const [openId, setOpenId] = useState<string | null>(null);

	const reviews = useQuery(
		trpc.domainReviews.list.queryOptions({
			status: ["PROPOSED"],
			limit: 100,
		}),
	);

	const rows = reviews.data?.rows ?? [];
	const openCount = reviews.data?.openCount ?? 0;

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>
					Sending domains to place
					{openCount > 0 ? (
						<span className="text-muted-foreground tabular-nums">
							{" "}
							{openCount}
						</span>
					) : null}
				</CardTitle>
				<CardDescription>
					{`Email arrived from a domain no ${BUSINESS.oneLower} claims. Nothing is invented from a domain, so each one waits for you.`}
					{rows.length < openCount
						? ` Showing the first ${rows.length} of ${openCount}.`
						: ""}
				</CardDescription>
			</CardHeader>
			<CardPanel>
				{rows.length === 0 ? (
					<CardPanelEmpty>Every sending domain is placed.</CardPanelEmpty>
				) : (
					<SimpleTable variant="panel" surface="page" columns={COLUMNS}>
						{rows.map((review) => (
							<ReviewRows
								key={review.id}
								review={review}
								open={openId === review.id}
								onToggle={() =>
									setOpenId(openId === review.id ? null : review.id)
								}
								onSettled={() => setOpenId(null)}
							/>
						))}
					</SimpleTable>
				)}
			</CardPanel>
		</Card>
	);
}

function ReviewRows({
	review,
	open,
	onToggle,
	onSettled,
}: {
	review: Review;
	open: boolean;
	onToggle: () => void;
	onSettled: () => void;
}) {
	return (
		<>
			<SimpleTableRow clickable onClick={onToggle}>
				<TableCell className={`${CELL} truncate pl-4 font-medium`}>
					<span className="flex min-w-0 flex-col">
						<span className="truncate">{review.domain}</span>
						{review.email ? (
							<span className="truncate text-muted-foreground text-xs">
								{review.email}
							</span>
						) : null}
					</span>
				</TableCell>
				<TableCell
					className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
				>
					{REASON[review.reason]}
				</TableCell>
				<TableCell
					className={`${CELL} hidden text-right tabular-nums sm:table-cell`}
				>
					{review.waitingContacts}
				</TableCell>
				<TableCell className={`${CELL} pr-4 text-right text-muted-foreground`}>
					<LocalRelativeTime date={review.lastSeenAt} />
				</TableCell>
			</SimpleTableRow>

			{open ? (
				<SimpleTableRow>
					<TableCell colSpan={COLUMNS.length} className="p-0">
						<ReviewDecision review={review} onSettled={onSettled} />
					</TableCell>
				</SimpleTableRow>
			) : null}
		</>
	);
}

function ReviewDecision({
	review,
	onSettled,
}: {
	review: Review;
	onSettled: () => void;
}) {
	const trpc = useTRPC();
	const cache = useCrmCache();

	const [companyId, setCompanyId] = useState("");
	const [name, setName] = useState(nameFromDomain(review.domain));
	const [entityType, setEntityType] = useState<EntityType>(EntityType.HOTEL);

	const pickerId = useId();
	const nameId = useId();
	const typeId = useId();

	const settled = async (moved: number) => {
		await cache.domainReviews();
		toast.success(
			moved === 1
				? `${review.domain} filed, 1 person moved.`
				: `${review.domain} filed, ${moved} people moved.`,
		);
		onSettled();
	};

	const file = useMutation(
		trpc.domainReviews.file.mutationOptions({
			onSuccess: (result) => settled(result.contactsMoved),
			onError: (error) => toast.error(error.message),
		}),
	);

	const fileToNew = useMutation(
		trpc.domainReviews.fileToNew.mutationOptions({
			onSuccess: (result) => settled(result.contactsMoved),
			onError: (error) => toast.error(error.message),
		}),
	);

	const dismiss = useMutation(
		trpc.domainReviews.dismiss.mutationOptions({
			onSuccess: async () => {
				await cache.domainReviews();
				toast.success(`${review.domain} dismissed.`);
				onSettled();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const pending = file.isPending || fileToNew.isPending || dismiss.isPending;

	return (
		<div className="flex flex-col gap-4 border-t bg-muted/40 px-4 py-4">
			{review.candidates.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-muted-foreground text-xs">
						Already in the CRM:
					</span>
					{review.candidates.map((candidate) => (
						<Button
							key={candidate.id}
							variant="outline"
							size="sm"
							disabled={pending}
							onClick={() =>
								file.mutate({ id: review.id, companyId: candidate.id })
							}
						>
							{candidate.name}
						</Button>
					))}
				</div>
			) : null}

			<div className="grid gap-4 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor={pickerId}>
						{`File to an existing ${BUSINESS.oneLower}`}
					</FieldLabel>
					<CompanyPicker
						id={pickerId}
						value={companyId}
						onValueChange={setCompanyId}
						disabled={pending}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={nameId}>{`New ${BUSINESS.oneLower}`}</FieldLabel>
					<Input
						id={nameId}
						value={name}
						disabled={pending}
						onChange={(event) => setName(event.target.value)}
						autoComplete="off"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={typeId}>Type</FieldLabel>
					<Select
						value={entityType}
						disabled={pending}
						onValueChange={(next) => setEntityType(next as EntityType)}
					>
						<SelectTrigger id={typeId}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ENTITY_TYPE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={pending}
					onClick={() => dismiss.mutate({ id: review.id })}
				>
					Dismiss
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={pending || name.trim() === ""}
					onClick={() => fileToNew.mutate({ id: review.id, name, entityType })}
				>
					{`Create ${BUSINESS.oneLower}`}
				</Button>
				<Button
					size="sm"
					disabled={pending || companyId === ""}
					onClick={() => file.mutate({ id: review.id, companyId })}
				>
					File
				</Button>
			</div>
		</div>
	);
}
