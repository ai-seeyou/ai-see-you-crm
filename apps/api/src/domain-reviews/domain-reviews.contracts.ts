import {
	DomainReviewReason,
	DomainReviewStatus,
	EntityType,
	RecordSource,
} from "@crm/db";
import { z } from "zod";

const domainReviewStatus = z.enum(
	Object.values(DomainReviewStatus) as [
		DomainReviewStatus,
		...DomainReviewStatus[],
	],
);

const domainReviewReason = z.enum(
	Object.values(DomainReviewReason) as [
		DomainReviewReason,
		...DomainReviewReason[],
	],
);

const domainReviewEntityType = z.enum(
	Object.values(EntityType) as [EntityType, ...EntityType[]],
);

const domainReviewSource = z.enum(
	Object.values(RecordSource) as [RecordSource, ...RecordSource[]],
);

export const domainReviewListInput = z.object({
	status: z.array(domainReviewStatus).default([DomainReviewStatus.PROPOSED]),
	limit: z.number().int().min(1).max(200).default(100),
});

export type DomainReviewListInput = z.infer<typeof domainReviewListInput>;

const domainReviewCandidateOutput = z.object({
	id: z.string(),
	name: z.string(),
	entityType: domainReviewEntityType,
	iconUrl: z.string().nullable(),
});

const domainReviewRowOutput = z.object({
	id: z.string(),
	domain: z.string(),
	email: z.string().nullable(),
	reason: domainReviewReason,
	status: domainReviewStatus,
	source: domainReviewSource,
	seenCount: z.number(),
	firstSeenAt: z.string(),
	lastSeenAt: z.string(),
	decidedAt: z.string().nullable(),
	company: z.object({ id: z.string(), name: z.string() }).nullable(),
	candidates: z.array(domainReviewCandidateOutput),
	waitingContacts: z.number(),
});

export const domainReviewListOutput = z.object({
	rows: z.array(domainReviewRowOutput),
	openCount: z.number(),
});

export const domainReviewFileInput = z.object({
	id: z.string(),
	companyId: z.string(),
});

export type DomainReviewFileInput = z.infer<typeof domainReviewFileInput>;

export const domainReviewCreateCompanyInput = z.object({
	id: z.string(),
	name: z.string().trim().min(1, "A business needs a name."),
	entityType: domainReviewEntityType.optional(),
	verticalId: z.string().nullable().optional(),
});

export type DomainReviewCreateCompanyInput = z.infer<
	typeof domainReviewCreateCompanyInput
>;

export const domainReviewIdInput = z.object({ id: z.string() });

export const domainReviewDecisionOutput = z.object({
	id: z.string(),
	domain: z.string(),
	status: domainReviewStatus,
	companyId: z.string().nullable(),
	contactsMoved: z.number(),
});
