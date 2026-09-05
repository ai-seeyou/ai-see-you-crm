import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	DomainReviewReason,
	DomainReviewStatus,
	db,
	EntityType,
} from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { CompaniesService } from "../src/companies/companies.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DomainReviewsService } from "../src/domain-reviews/domain-reviews.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "domain-reviews";
const FILED_DOMAIN = `wsc-filed-${suffix}.test`;
const CREATED_DOMAIN = `wsc-created-${suffix}.test`;
const DISMISSED_DOMAIN = `wsc-dismissed-${suffix}.test`;
const OTHER_DOMAIN = `wsc-other-${suffix}.test`;
const userId = `wsc-reviews-user-${suffix}`;

const domains = [FILED_DOMAIN, CREATED_DOMAIN, DISMISSED_DOMAIN, OTHER_DOMAIN];

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	companyRequested: async () => true,
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => ({ queued: 0, merged: 0 }),
} as unknown as AgentTriggerService;

const companies = new CompaniesService(
	db,
	agent,
	new AgentQueueService(db),
	{ backfill: async () => undefined } as unknown as FaviconService,
	new ActivityStampService(db),
	new ConversionService(db),
	new FieldsService(db, agent),
);

const reviews = new DomainReviewsService(db, companies);

let hotelId: string;
let otherCompanyId: string;
let waitingOneId: string;
let waitingTwoId: string;
let employedElsewhereId: string;
let filedReviewId: string;
let createdReviewId: string;
let dismissedReviewId: string;

async function review(
	domain: string,
	reason: DomainReviewReason,
): Promise<string> {
	const row = await db.domainReview.create({
		data: { domain, email: `hello@${domain}`, reason },
		select: { id: true },
	});
	return row.id;
}

async function clean(): Promise<void> {
	await db.domainReview.deleteMany({ where: { domain: { in: domains } } });
	await db.contact.deleteMany({
		where: { email: { endsWith: `-${suffix}.test` } },
	});
	await db.company.deleteMany({ where: { domain: { in: domains } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();

	await db.user.create({
		data: {
			id: userId,
			name: "Reviews Founder",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});

	const hotel = await db.company.create({
		data: {
			name: `WSC Filed Hotel ${suffix}`,
			domain: FILED_DOMAIN,
			entityType: EntityType.HOTEL,
		},
		select: { id: true },
	});
	hotelId = hotel.id;

	const other = await db.company.create({
		data: {
			name: `WSC Other ${suffix}`,
			domain: OTHER_DOMAIN,
			entityType: EntityType.HOTEL,
		},
		select: { id: true },
	});
	otherCompanyId = other.id;

	const waitingOne = await db.contact.create({
		data: { firstName: "Ada", email: `ada@${FILED_DOMAIN}` },
		select: { id: true },
	});
	waitingOneId = waitingOne.id;

	const waitingTwo = await db.contact.create({
		data: { firstName: "Brix", email: `brix@${FILED_DOMAIN}` },
		select: { id: true },
	});
	waitingTwoId = waitingTwo.id;

	const employed = await db.contact.create({
		data: {
			firstName: "Cleo",
			email: `cleo@${FILED_DOMAIN}`,
			companyId: otherCompanyId,
		},
		select: { id: true },
	});
	employedElsewhereId = employed.id;

	filedReviewId = await review(FILED_DOMAIN, DomainReviewReason.AMBIGUOUS);
	createdReviewId = await review(
		CREATED_DOMAIN,
		DomainReviewReason.UNRECOGNISED,
	);
	dismissedReviewId = await review(
		DISMISSED_DOMAIN,
		DomainReviewReason.UNRECOGNISED,
	);
});

afterAll(async () => {
	await clean();
});

describe("the domain review queue", () => {
	it("is readable, and says how many contacts wait on each domain", async () => {
		const listed = await reviews.list({
			status: [DomainReviewStatus.PROPOSED],
			limit: 200,
		});

		const filed = listed.rows.find((row) => row.id === filedReviewId);

		expect(filed).toBeDefined();
		expect(filed?.waitingContacts).toBe(2);
		expect(filed?.candidates.map((row) => row.id)).toEqual([hotelId]);
	});

	it("files a domain to a business and moves the contacts waiting on it", async () => {
		const filed = await reviews.fileToCompany(
			{ id: filedReviewId, companyId: hotelId },
			userId,
		);

		expect(filed.status).toBe(DomainReviewStatus.APPLIED);
		expect(filed.companyId).toBe(hotelId);
		expect(filed.contactsMoved).toBe(2);

		const moved = await db.contact.findMany({
			where: { id: { in: [waitingOneId, waitingTwoId] } },
			select: { id: true, companyId: true },
		});
		for (const contact of moved) {
			expect(contact.companyId).toBe(hotelId);
		}

		const stayed = await db.contact.findUnique({
			where: { id: employedElsewhereId },
			select: { companyId: true },
		});
		expect(stayed?.companyId).toBe(otherCompanyId);
	});

	it("records who decided it and when", async () => {
		const decided = await db.domainReview.findUnique({
			where: { id: filedReviewId },
			select: { decidedById: true, decidedAt: true },
		});

		expect(decided?.decidedById).toBe(userId);
		expect(decided?.decidedAt).not.toBeNull();
	});

	it("lets the database trigger write the employer assignment for the moved contacts", async () => {
		const employers = await db.contactAssignment.findMany({
			where: {
				contactId: { in: [waitingOneId, waitingTwoId] },
				scope: AssignmentScope.EMPLOYER,
				validTo: null,
			},
			select: { companyId: true, isPrimary: true },
		});

		expect(employers).toHaveLength(2);
		for (const row of employers) {
			expect(row.companyId).toBe(hotelId);
			expect(row.isPrimary).toBe(true);
		}
	});

	it("files a domain by creating the business", async () => {
		const filed = await reviews.fileToNewCompany(
			{
				id: createdReviewId,
				name: `WSC Created ${suffix}`,
				entityType: EntityType.HOTEL_GROUP,
			},
			userId,
		);

		expect(filed.status).toBe(DomainReviewStatus.APPLIED);
		expect(filed.companyId).not.toBeNull();

		const created = await db.company.findUnique({
			where: { id: filed.companyId ?? "" },
			select: { name: true, domain: true, entityType: true },
		});

		expect(created?.domain).toBe(CREATED_DOMAIN);
		expect(created?.entityType).toBe(EntityType.HOTEL_GROUP);
	});

	it("dismisses a domain without filing it anywhere", async () => {
		const dismissed = await reviews.dismiss(dismissedReviewId, userId);

		expect(dismissed.status).toBe(DomainReviewStatus.DISMISSED);
		expect(dismissed.companyId).toBeNull();
		expect(dismissed.contactsMoved).toBe(0);
	});

	it("leaves nothing open once every review is decided", async () => {
		const listed = await reviews.list({
			status: [DomainReviewStatus.PROPOSED],
			limit: 200,
		});

		expect(listed.rows.map((row) => row.id)).not.toContain(filedReviewId);
		expect(listed.rows.map((row) => row.id)).not.toContain(createdReviewId);
		expect(listed.rows.map((row) => row.id)).not.toContain(dismissedReviewId);
	});

	it("refuses to file a review that does not exist", async () => {
		await expect(
			reviews.fileToCompany(
				{ id: `missing-${suffix}`, companyId: hotelId },
				userId,
			),
		).rejects.toThrow("No domain review with id");
	});
});
