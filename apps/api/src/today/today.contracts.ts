import { ActivityType, DealStage } from "@crm/db";
import { z } from "zod";

const TODAY_SCOPES = ["me", "everyone"] as const;

export const todaySummaryInput = z.object({
	scope: z.enum(TODAY_SCOPES).default("me"),
});

export type TodaySummaryInput = z.infer<typeof todaySummaryInput>;

const linkedRecordOutput = z.object({ id: z.string(), name: z.string() });

const ownerOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

const todayTaskOutput = z.object({
	id: z.string(),
	type: z.enum(
		Object.values(ActivityType) as [ActivityType, ...ActivityType[]],
	),
	subject: z.string().nullable(),
	dueAt: z.string().nullable(),
	dueInDays: z.number().nullable(),
	company: linkedRecordOutput.nullable(),
	contact: linkedRecordOutput.nullable(),
	deal: linkedRecordOutput.nullable(),
});

const todayOpportunityOutput = z.object({
	id: z.string(),
	name: z.string(),
	stage: z.enum(Object.values(DealStage) as [DealStage, ...DealStage[]]),
	company: linkedRecordOutput,
	owner: ownerOutput,
	lastActivityAt: z.string().nullable(),
	stageChangedAt: z.string(),
	expectedCloseDate: z.string().nullable(),
	quietForDays: z.number(),
});

const todayReplyOutput = z.object({
	threadId: z.string(),
	messageId: z.string(),
	subject: z.string().nullable(),
	snippet: z.string().nullable(),
	fromEmail: z.string(),
	fromName: z.string().nullable(),
	sentAt: z.string(),
	company: linkedRecordOutput.nullable(),
	contact: linkedRecordOutput.nullable(),
});

export const todaySummaryOutput = z.object({
	scope: z.enum(TODAY_SCOPES),
	generatedAt: z.string(),
	thresholds: z.object({
		followUpWithinDays: z.number(),
		replySinceDays: z.number(),
		opportunityStaleAfterDays: z.number(),
	}),
	overdueTasks: z.array(todayTaskOutput),
	followUps: z.array(todayTaskOutput),
	staleOpportunities: z.array(todayOpportunityOutput),
	replies: z.array(todayReplyOutput),
	counts: z.object({
		overdueTasks: z.number(),
		followUps: z.number(),
		staleOpportunities: z.number(),
		replies: z.number(),
	}),
});
