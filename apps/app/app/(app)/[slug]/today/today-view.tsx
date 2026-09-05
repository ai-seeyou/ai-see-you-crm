"use client";

import {
	Card,
	CardDescription,
	CardHeader,
	CardPanel,
	CardPanelEmpty,
	CardTitle,
} from "@crm/ui/components/card";
import { Checkbox } from "@crm/ui/components/checkbox";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import {
	SimpleTable,
	type SimpleTableColumn,
	SimpleTableRow,
} from "@crm/ui/components/simple-table";
import { Spinner } from "@crm/ui/components/spinner";
import { TableCell } from "@crm/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { DealStageIndicator } from "@/components/crm/deal-stage";
import { RecordLink } from "@/components/crm/record-sheet/record-link";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { LocalRelativeTime } from "@/components/local-date-time";
import { activityLabel } from "@/lib/activity-presentation";
import { BUSINESS, OPPORTUNITY } from "@/lib/labels";
import { SEARCH_PARAM } from "@/lib/search-param-keys";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { overviewParsers } from "../overview-search-params";
import { DomainReviewCard } from "./domain-review-card";

type Today = RouterOutputs["today"]["summary"];
type Task = Today["overdueTasks"][number];

const CELL = "px-3 py-2.5 align-middle";

const TASK_COLUMNS: SimpleTableColumn[] = [
	{ id: "done", srLabel: "Done", width: "w-8" },
	{ id: "task", header: "Task" },
	{ id: "when", header: "Due", width: "w-24", align: "right" },
];

const QUIET_COLUMNS: SimpleTableColumn[] = [
	{ id: "deal", header: OPPORTUNITY.one },
	{
		id: "company",
		header: BUSINESS.one,
		width: "w-40",
		className: "hidden md:table-cell",
	},
	{
		id: "stage",
		header: "Stage",
		width: "w-32",
		className: "hidden lg:table-cell",
	},
	{ id: "quiet", header: "Quiet for", width: "w-24", align: "right" },
];

const REPLY_COLUMNS: SimpleTableColumn[] = [
	{ id: "from", header: "From" },
	{
		id: "subject",
		header: "Subject",
		width: "w-56",
		className: "hidden md:table-cell",
	},
	{
		id: "company",
		header: BUSINESS.one,
		width: "w-40",
		className: "hidden lg:table-cell",
	},
	{ id: "when", header: "When", width: "w-20", align: "right" },
];

function showing(shown: number, total: number): string | null {
	if (total <= shown) return null;
	return `Showing the first ${shown} of ${total}.`;
}

function TodayCard({
	title,
	description,
	shown,
	total,
	empty,
	columns,
	children,
}: {
	title: string;
	description: string;
	shown: number;
	total: number;
	empty: string;
	columns: SimpleTableColumn[];
	children: ReactNode;
}) {
	const more = showing(shown, total);

	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>
					{title}
					{total > 0 ? (
						<span className="text-muted-foreground tabular-nums"> {total}</span>
					) : null}
				</CardTitle>
				<CardDescription>
					{description}
					{more ? ` ${more}` : ""}
				</CardDescription>
			</CardHeader>
			<CardPanel>
				{shown === 0 ? (
					<CardPanelEmpty>{empty}</CardPanelEmpty>
				) : (
					<SimpleTable variant="panel" surface="page" columns={columns}>
						{children}
					</SimpleTable>
				)}
			</CardPanel>
		</Card>
	);
}

function TaskRow({
	task,
	onComplete,
	completing,
}: {
	task: Task;
	onComplete: () => void;
	completing: boolean;
}) {
	return (
		<SimpleTableRow>
			<TableCell className={`${CELL} pl-4`}>
				<Checkbox
					checked={false}
					disabled={completing}
					onCheckedChange={onComplete}
					aria-label={`Complete ${task.subject ?? activityLabel(task.type)}`}
				/>
			</TableCell>
			<TableCell className={`${CELL} min-w-0`}>
				<span className="flex min-w-0 flex-col">
					<span className="truncate">
						{task.subject ?? activityLabel(task.type)}
					</span>
					<span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
						{task.company ? (
							<RecordLink kind="company" id={task.company.id}>
								{task.company.name}
							</RecordLink>
						) : null}
						{task.contact ? (
							<RecordLink kind="contact" id={task.contact.id}>
								{task.contact.name}
							</RecordLink>
						) : null}
						{task.deal ? (
							<RecordLink kind="deal" id={task.deal.id}>
								{task.deal.name}
							</RecordLink>
						) : null}
					</span>
				</span>
			</TableCell>
			<TableCell className={`${CELL} pr-4 text-right text-muted-foreground`}>
				{task.dueAt ? (
					<LocalRelativeTime date={task.dueAt} />
				) : (
					<EmptyCellValue />
				)}
			</TableCell>
		</SimpleTableRow>
	);
}

export function TodayView() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const openRecord = useOpenRecord();

	const [scope] = useQueryState(
		SEARCH_PARAM.overview.scope,
		overviewParsers[SEARCH_PARAM.overview.scope],
	);

	const summaryQuery = useQuery({
		...trpc.today.summary.queryOptions({ scope }),
		placeholderData: (previous) => previous,
	});

	const complete = useMutation(
		trpc.activities.complete.mutationOptions({
			onSuccess: () => cache.activity(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const today = summaryQuery.data;

	if (!today) {
		return (
			<div className="flex flex-1 justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const { thresholds, counts } = today;
	const mine = scope === "me";

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-6 @3xl/page-content:grid-cols-2">
				<TodayCard
					title="Overdue"
					description={
						mine
							? "Your tasks past their due date"
							: "Tasks past their due date"
					}
					shown={today.overdueTasks.length}
					total={counts.overdueTasks}
					empty={mine ? "Nothing overdue for you." : "Nothing overdue."}
					columns={TASK_COLUMNS}
				>
					{today.overdueTasks.map((task) => (
						<TaskRow
							key={task.id}
							task={task}
							completing={complete.isPending}
							onComplete={() => complete.mutate({ id: task.id })}
						/>
					))}
				</TodayCard>

				<TodayCard
					title="Due next"
					description={`Follow-ups due in the next ${thresholds.followUpWithinDays} days`}
					shown={today.followUps.length}
					total={counts.followUps}
					empty={mine ? "Nothing due for you." : "Nothing due."}
					columns={TASK_COLUMNS}
				>
					{today.followUps.map((task) => (
						<TaskRow
							key={task.id}
							task={task}
							completing={complete.isPending}
							onComplete={() => complete.mutate({ id: task.id })}
						/>
					))}
				</TodayCard>

				<TodayCard
					title="Gone quiet"
					description={`Open ${OPPORTUNITY.manyLower} with nothing on them for ${thresholds.opportunityStaleAfterDays} days`}
					shown={today.staleOpportunities.length}
					total={counts.staleOpportunities}
					empty={`No ${OPPORTUNITY.oneLower}${mine ? " of yours" : ""} has gone quiet.`}
					columns={QUIET_COLUMNS}
				>
					{today.staleOpportunities.map((deal) => (
						<SimpleTableRow
							key={deal.id}
							clickable
							onClick={() => openRecord({ kind: "deal", id: deal.id })}
						>
							<TableCell className={`${CELL} truncate pl-4 font-medium`}>
								{deal.name}
							</TableCell>
							<TableCell
								className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
							>
								{deal.company.name}
							</TableCell>
							<TableCell className={`${CELL} hidden lg:table-cell`}>
								<DealStageIndicator stage={deal.stage} />
							</TableCell>
							<TableCell className={`${CELL} pr-4 text-right tabular-nums`}>
								{deal.quietForDays}d
							</TableCell>
						</SimpleTableRow>
					))}
				</TodayCard>

				<TodayCard
					title="Replies"
					description={`Inbound email in the last ${thresholds.replySinceDays} days`}
					shown={today.replies.length}
					total={counts.replies}
					empty={mine ? "Nobody has replied to you." : "Nobody has replied."}
					columns={REPLY_COLUMNS}
				>
					{today.replies.map((reply) => (
						<SimpleTableRow key={reply.messageId}>
							<TableCell className={`${CELL} truncate pl-4`}>
								{reply.contact ? (
									<RecordLink
										kind="contact"
										id={reply.contact.id}
										className="text-foreground"
									>
										{reply.contact.name}
									</RecordLink>
								) : (
									<span className="truncate">
										{reply.fromName ?? reply.fromEmail}
									</span>
								)}
							</TableCell>
							<TableCell
								className={`${CELL} hidden truncate text-muted-foreground md:table-cell`}
							>
								{reply.subject ?? <EmptyCellValue />}
							</TableCell>
							<TableCell className={`${CELL} hidden truncate lg:table-cell`}>
								{reply.company ? (
									<RecordLink kind="company" id={reply.company.id}>
										{reply.company.name}
									</RecordLink>
								) : (
									<EmptyCellValue />
								)}
							</TableCell>
							<TableCell
								className={`${CELL} pr-4 text-right text-muted-foreground`}
							>
								<LocalRelativeTime date={reply.sentAt} />
							</TableCell>
						</SimpleTableRow>
					))}
				</TodayCard>
			</div>

			<DomainReviewCard />
		</div>
	);
}
