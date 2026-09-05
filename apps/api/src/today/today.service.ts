import { ActivityType, type Db, EmailDirection, type Prisma } from "@crm/db";
import { OPEN_DEAL_STAGES } from "@crm/db/deal-stage";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type { TodaySummaryInput } from "./today.contracts";
import { TODAY } from "./today-config";

const LINKED_SELECT = { id: true, name: true } as const;

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const TASK_SELECT = {
	id: true,
	type: true,
	subject: true,
	dueAt: true,
	company: { select: LINKED_SELECT },
	contact: { select: { id: true, firstName: true, lastName: true } },
	deal: { select: LINKED_SELECT },
} as const;

type TaskRow = Prisma.ActivityGetPayload<{ select: typeof TASK_SELECT }>;

function contactName(contact: {
	firstName: string;
	lastName: string | null;
}): string {
	return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

function wholeDays(ms: number): number {
	return Math.round(ms / TODAY.dayMs);
}

function serializeTask(task: TaskRow, now: Date) {
	return {
		id: task.id,
		type: task.type,
		subject: task.subject,
		dueAt: task.dueAt?.toISOString() ?? null,
		dueInDays: task.dueAt
			? wholeDays(task.dueAt.getTime() - now.getTime())
			: null,
		company: task.company,
		contact: task.contact
			? { id: task.contact.id, name: contactName(task.contact) }
			: null,
		deal: task.deal,
	};
}

@Injectable()
export class TodayService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async summary(actingUserId: string, input: TodaySummaryInput) {
		const mine = input.scope === "me";
		const now = new Date();

		const followUpUntil = new Date(now.getTime() + TODAY.followUps.dueWithinMs);
		const replySince = new Date(now.getTime() - TODAY.replies.sinceMs);
		const quietSince = new Date(
			now.getTime() - TODAY.opportunities.staleAfterMs,
		);

		const taskWhere: Prisma.ActivityWhereInput = {
			type: ActivityType.TASK,
			completedAt: null,
			...(mine ? { createdById: actingUserId } : {}),
		};

		const overdueWhere: Prisma.ActivityWhereInput = {
			...taskWhere,
			dueAt: { lt: now },
		};

		const followUpWhere: Prisma.ActivityWhereInput = {
			...taskWhere,
			dueAt: { gte: now, lte: followUpUntil },
		};

		const staleWhere: Prisma.DealWhereInput = {
			archivedAt: null,
			stage: { in: [...OPEN_DEAL_STAGES] },
			...(mine ? { ownerId: actingUserId } : {}),
			OR: [
				{ lastActivityAt: { lt: quietSince } },
				{ lastActivityAt: null, stageChangedAt: { lt: quietSince } },
			],
		};

		const replyWhere: Prisma.EmailThreadWhereInput = {
			lastMessageAt: { gte: replySince },
			messages: {
				some: {
					direction: EmailDirection.INBOUND,
					sentAt: { gte: replySince },
				},
			},
		};

		const [
			overdueTasks,
			overdueCount,
			followUps,
			followUpCount,
			staleOpportunities,
			staleCount,
			replyThreads,
			replyCount,
		] = await Promise.all([
			this.db.activity.findMany({
				where: overdueWhere,
				orderBy: [{ dueAt: "asc" }],
				take: TODAY.overdueTasks.limit,
				select: TASK_SELECT,
			}),
			this.db.activity.count({ where: overdueWhere }),
			this.db.activity.findMany({
				where: followUpWhere,
				orderBy: [{ dueAt: "asc" }],
				take: TODAY.followUps.limit,
				select: TASK_SELECT,
			}),
			this.db.activity.count({ where: followUpWhere }),
			this.db.deal.findMany({
				where: staleWhere,
				orderBy: [{ lastActivityAt: { sort: "asc", nulls: "first" } }],
				take: TODAY.opportunities.limit,
				select: {
					id: true,
					name: true,
					stage: true,
					lastActivityAt: true,
					stageChangedAt: true,
					expectedCloseDate: true,
					company: { select: LINKED_SELECT },
					owner: { select: OWNER_SELECT },
				},
			}),
			this.db.deal.count({ where: staleWhere }),
			this.db.emailThread.findMany({
				where: replyWhere,
				orderBy: [{ lastMessageAt: "desc" }],
				take: TODAY.replies.limit,
				select: {
					id: true,
					subject: true,
					company: { select: LINKED_SELECT },
					contact: { select: { id: true, firstName: true, lastName: true } },
					messages: {
						where: {
							direction: EmailDirection.INBOUND,
							sentAt: { gte: replySince },
						},
						orderBy: [{ sentAt: "desc" }],
						take: 1,
						select: {
							id: true,
							snippet: true,
							fromEmail: true,
							fromName: true,
							sentAt: true,
						},
					},
				},
			}),
			this.db.emailThread.count({ where: replyWhere }),
		]);

		return {
			scope: input.scope,
			generatedAt: now.toISOString(),
			thresholds: {
				followUpWithinDays: wholeDays(TODAY.followUps.dueWithinMs),
				replySinceDays: wholeDays(TODAY.replies.sinceMs),
				opportunityStaleAfterDays: wholeDays(TODAY.opportunities.staleAfterMs),
			},
			overdueTasks: overdueTasks.map((task) => serializeTask(task, now)),
			followUps: followUps.map((task) => serializeTask(task, now)),
			staleOpportunities: staleOpportunities.map((deal) => ({
				id: deal.id,
				name: deal.name,
				stage: deal.stage,
				company: deal.company,
				owner: deal.owner,
				lastActivityAt: deal.lastActivityAt?.toISOString() ?? null,
				stageChangedAt: deal.stageChangedAt.toISOString(),
				expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
				quietForDays: wholeDays(
					now.getTime() -
						(deal.lastActivityAt ?? deal.stageChangedAt).getTime(),
				),
			})),
			replies: replyThreads.flatMap((thread) => {
				const message = thread.messages[0];
				if (!message) return [];
				return [
					{
						threadId: thread.id,
						messageId: message.id,
						subject: thread.subject,
						snippet: message.snippet,
						fromEmail: message.fromEmail,
						fromName: message.fromName,
						sentAt: message.sentAt.toISOString(),
						company: thread.company,
						contact: thread.contact
							? { id: thread.contact.id, name: contactName(thread.contact) }
							: null,
					},
				];
			}),
			counts: {
				overdueTasks: overdueCount,
				followUps: followUpCount,
				staleOpportunities: staleCount,
				replies: replyCount,
			},
		};
	}
}
