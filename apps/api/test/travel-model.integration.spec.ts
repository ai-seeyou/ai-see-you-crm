import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	ContactRoleType,
	DomainReviewReason,
	DomainReviewStatus,
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RelationshipType,
} from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { CompaniesService } from "../src/companies/companies.service";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { ContactAssignmentService } from "../src/contacts/contact-assignment.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "travel-model";
const SHARED_DOMAIN = `accor-${suffix}.test`;
const OWN_DOMAIN = `novotel-brisbane-${suffix}.test`;

const agent = {
	contactCreated: async () => true,
	companyCreated: async () => undefined,
	companyRequested: async () => true,
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => ({ queued: 0, merged: 0 }),
} as unknown as AgentTriggerService;

const assignments = new ContactAssignmentService(db);
const directory = new CompanyDirectoryService(db);
const fields = new FieldsService(db, agent);
const companies = new CompaniesService(
	db,
	agent,
	new AgentQueueService(db),
	{ backfill: async () => undefined } as unknown as FaviconService,
	new ActivityStampService(db),
	new ConversionService(db),
	fields,
);

async function created(
	data: Parameters<typeof db.externalRef.create>[0]["data"],
): Promise<void> {
	await db.externalRef.create({ data, select: { id: true } });
}

type Ids = {
	group: string;
	management: string;
	sofitelSydney: string;
	sofitelMelbourne: string;
	novotelBrisbane: string;
	director: string;
};

let ids: Ids;
let hotelVerticalId: string;

// Through CompaniesService, not through Prisma. The guard that refused a second
// business on one corporate domain lived in the service, so a test that wrote
// straight to the table proved the schema and missed the product.
async function company(
	name: string,
	entityType: EntityType,
	domain: string | null,
): Promise<string> {
	const created = await companies.create({
		name,
		domain: domain ?? undefined,
		ownerId: null,
	});

	const row = await db.company.update({
		where: { id: created.id },
		data: { entityType, verticalId: hotelVerticalId },
		select: { id: true },
	});
	return row.id;
}

async function relate(
	fromCompanyId: string,
	toCompanyId: string,
	type: RelationshipType,
): Promise<void> {
	await db.entityRelationship.create({
		data: { fromCompanyId, toCompanyId, type, validFrom: new Date() },
		select: { id: true },
	});
}

async function clean(): Promise<void> {
	const rows = await db.company.findMany({
		where: { OR: [{ domain: SHARED_DOMAIN }, { domain: OWN_DOMAIN }] },
		select: { id: true },
	});
	const companyIds = rows.map((row) => row.id);

	await db.externalRef.deleteMany({
		where: { recordId: { in: companyIds } },
	});
	await db.contact.deleteMany({
		where: { email: { endsWith: `@${SHARED_DOMAIN}` } },
	});
	await db.company.deleteMany({ where: { id: { in: companyIds } } });
}

beforeAll(async () => {
	await clean();

	const hotel = await db.vertical.findFirst({
		where: { key: "hotel" },
		select: { id: true },
	});
	if (!hotel) {
		throw new Error(
			"The hotel vertical is missing. Migration 20260905034827 seeds it, so the test database is behind.",
		);
	}
	hotelVerticalId = hotel.id;

	const group = await company(
		"Accor Hotel Group",
		EntityType.HOTEL_GROUP,
		SHARED_DOMAIN,
	);
	const management = await company(
		"Accor Management APAC",
		EntityType.MANAGEMENT_COMPANY,
		SHARED_DOMAIN,
	);
	const sofitelSydney = await company(
		"Sofitel Sydney Darling Harbour",
		EntityType.HOTEL,
		SHARED_DOMAIN,
	);
	const sofitelMelbourne = await company(
		"Sofitel Melbourne on Collins",
		EntityType.HOTEL,
		SHARED_DOMAIN,
	);
	const novotelBrisbane = await company(
		"Novotel Brisbane",
		EntityType.HOTEL,
		OWN_DOMAIN,
	);

	for (const property of [sofitelSydney, sofitelMelbourne, novotelBrisbane]) {
		await relate(property, group, RelationshipType.BELONGS_TO);
		await relate(property, management, RelationshipType.MANAGED_BY);
	}

	const director = await db.contact.create({
		data: {
			firstName: "Margot",
			lastName: "Vidal",
			email: `margot.vidal@${SHARED_DOMAIN}`,
			title: "Group Director of Distribution",
			companyId: group,
		},
		select: { id: true },
	});

	await assignments.assignResponsibilities({
		contactId: director.id,
		companyIds: [sofitelSydney, sofitelMelbourne, novotelBrisbane],
		roleType: ContactRoleType.DISTRIBUTION,
		title: "Group Director of Distribution",
	});

	ids = {
		group,
		management,
		sofitelSydney,
		sofitelMelbourne,
		novotelBrisbane,
		director: director.id,
	};
});

afterAll(async () => {
	await clean();
});

describe("a hotel group, its properties and its management company", () => {
	it("keeps three properties distinct even though two share a corporate domain", async () => {
		const sharing = await db.company.findMany({
			where: { domain: SHARED_DOMAIN, entityType: EntityType.HOTEL },
			select: { id: true, name: true },
			orderBy: { name: "asc" },
		});

		expect(sharing).toHaveLength(2);
		expect(sharing.map((row) => row.name)).toEqual([
			"Sofitel Melbourne on Collins",
			"Sofitel Sydney Darling Harbour",
		]);
		expect(sharing[0]?.id).not.toBe(sharing[1]?.id);
	});

	it("puts the group, the management company and a property on one domain without collision", async () => {
		const onDomain = await db.company.findMany({
			where: { domain: SHARED_DOMAIN },
			select: { entityType: true },
		});

		expect(onDomain).toHaveLength(4);
		expect(new Set(onDomain.map((row) => row.entityType))).toEqual(
			new Set([
				EntityType.HOTEL_GROUP,
				EntityType.MANAGEMENT_COMPANY,
				EntityType.HOTEL,
			]),
		);
	});

	it("reads down, from the group to the properties that belong to it", async () => {
		const properties = await db.entityRelationship.findMany({
			where: {
				toCompanyId: ids.group,
				type: RelationshipType.BELONGS_TO,
				validTo: null,
			},
			select: { fromCompany: { select: { name: true } } },
			orderBy: { fromCompany: { name: "asc" } },
		});

		expect(properties.map((row) => row.fromCompany.name)).toEqual([
			"Novotel Brisbane",
			"Sofitel Melbourne on Collins",
			"Sofitel Sydney Darling Harbour",
		]);
	});

	it("reads up, from a property to the group and the management company", async () => {
		const parents = await db.entityRelationship.findMany({
			where: { fromCompanyId: ids.sofitelSydney, validTo: null },
			select: { type: true, toCompany: { select: { name: true } } },
			orderBy: { type: "asc" },
		});

		expect(parents).toEqual([
			{
				type: RelationshipType.BELONGS_TO,
				toCompany: { name: "Accor Hotel Group" },
			},
			{
				type: RelationshipType.MANAGED_BY,
				toCompany: { name: "Accor Management APAC" },
			},
		]);
	});

	it("refuses a second current relationship of the same type between the same two", async () => {
		await expect(
			relate(ids.sofitelSydney, ids.group, RelationshipType.BELONGS_TO),
		).rejects.toThrow();
	});
});

describe("a senior group contact", () => {
	it("is employed at the group, and the employer assignment matches Contact.companyId", async () => {
		const contact = await db.contact.findUnique({
			where: { id: ids.director },
			select: { companyId: true },
		});
		const employer = await db.contactAssignment.findFirst({
			where: {
				contactId: ids.director,
				scope: AssignmentScope.EMPLOYER,
				validTo: null,
			},
			select: { companyId: true, isPrimary: true },
		});

		expect(contact?.companyId).toBe(ids.group);
		expect(employer?.companyId).toBe(ids.group);
		expect(employer?.isPrimary).toBe(true);
	});

	it("is responsible for all three properties, and none of them employs them", async () => {
		const responsible = await db.contactAssignment.findMany({
			where: {
				contactId: ids.director,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				validTo: null,
			},
			select: { companyId: true, roleType: true, isPrimary: true },
		});

		expect(responsible).toHaveLength(3);
		expect(new Set(responsible.map((row) => row.companyId))).toEqual(
			new Set([ids.sofitelSydney, ids.sofitelMelbourne, ids.novotelBrisbane]),
		);
		for (const row of responsible) {
			expect(row.roleType).toBe(ContactRoleType.DISTRIBUTION);
			expect(row.isPrimary).toBe(false);
		}
	});

	it("is found from a property, which is the direction the old model could not answer", async () => {
		const people = await db.contactAssignment.findMany({
			where: {
				companyId: ids.novotelBrisbane,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.DISTRIBUTION,
				validTo: null,
			},
			select: { contact: { select: { id: true, title: true } } },
		});

		expect(people).toHaveLength(1);
		expect(people[0]?.contact.id).toBe(ids.director);
		expect(people[0]?.contact.title).toBe("Group Director of Distribution");
	});

	it("does not appear in the property's employee list, because they work for the group", async () => {
		const employees = await db.contact.findMany({
			where: { companyId: ids.novotelBrisbane },
			select: { id: true },
		});

		expect(employees).toHaveLength(0);
	});

	it("keeps the employer row in step when the employer changes", async () => {
		await assignments.setEmployer({
			contactId: ids.director,
			companyId: ids.management,
		});

		const current = await db.contactAssignment.findMany({
			where: {
				contactId: ids.director,
				scope: AssignmentScope.EMPLOYER,
				validTo: null,
			},
			select: { companyId: true, isPrimary: true },
		});
		const ended = await db.contactAssignment.count({
			where: {
				contactId: ids.director,
				scope: AssignmentScope.EMPLOYER,
				companyId: ids.group,
				validTo: { not: null },
			},
		});

		expect(current).toHaveLength(1);
		expect(current[0]?.companyId).toBe(ids.management);
		expect(current[0]?.isPrimary).toBe(true);
		expect(ended).toBe(1);

		await assignments.setEmployer({
			contactId: ids.director,
			companyId: ids.group,
		});
	});
});

describe("canonical external references", () => {
	it("records a confirmed Production reference and an unconfirmed proposal apart", async () => {
		await db.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: ids.sofitelSydney,
				system: ExternalSystem.PRODUCTION,
				externalId: `prod-${suffix}-sydney`,
				matchMethod: "name and city, verified by a human",
				matchedBy: MatchActor.HUMAN,
				confirmedAt: new Date(),
			},
			select: { id: true },
		});

		await db.externalRef.create({
			data: {
				recordType: ExternalRecordType.COMPANY,
				recordId: ids.sofitelMelbourne,
				system: ExternalSystem.PRODUCTION,
				externalId: `prod-${suffix}-melbourne`,
				matchMethod: "name similarity",
				matchedBy: MatchActor.AGENT,
			},
			select: { id: true },
		});

		const canonical = await db.externalRef.findMany({
			where: {
				system: ExternalSystem.PRODUCTION,
				recordId: { in: [ids.sofitelSydney, ids.sofitelMelbourne] },
				confirmedAt: { not: null },
			},
			select: { recordId: true },
		});

		expect(canonical).toHaveLength(1);
		expect(canonical[0]?.recordId).toBe(ids.sofitelSydney);
	});

	it("refuses to let a second business claim the same Production record", async () => {
		await expect(
			created({
				recordType: ExternalRecordType.COMPANY,
				recordId: ids.novotelBrisbane,
				system: ExternalSystem.PRODUCTION,
				externalId: `prod-${suffix}-sydney`,
				matchMethod: "a mistake",
				matchedBy: MatchActor.IMPORT,
			}),
		).rejects.toThrow();
	});

	it("refuses to let one business claim two Production records", async () => {
		await expect(
			created({
				recordType: ExternalRecordType.COMPANY,
				recordId: ids.sofitelSydney,
				system: ExternalSystem.PRODUCTION,
				externalId: `prod-${suffix}-duplicate`,
				matchMethod: "a mistake",
				matchedBy: MatchActor.IMPORT,
			}),
		).rejects.toThrow();
	});
});

describe("an unfiled sending domain", () => {
	it("files nobody's business by guess, and raises the domain for review", async () => {
		const domain = `unfiled-${suffix}.test`;
		await db.domainReview.deleteMany({ where: { domain } });

		const companyId = await directory.companyForEmail(`gm@${domain}`);

		expect(companyId).toBeNull();
		expect(await db.company.count({ where: { domain } })).toBe(0);

		const review = await db.domainReview.findFirst({
			where: { domain },
			select: { reason: true, status: true, seenCount: true },
		});

		expect(review?.status).toBe(DomainReviewStatus.PROPOSED);
		expect(review?.reason).toBe(DomainReviewReason.UNRECOGNISED);

		await directory.companyForEmail(`revenue@${domain}`);
		const seenAgain = await db.domainReview.findFirst({
			where: { domain },
			select: { seenCount: true },
		});

		expect(seenAgain?.seenCount).toBe(2);
		await db.domainReview.deleteMany({ where: { domain } });
	});

	it("stays dismissed once a human has dismissed it", async () => {
		const domain = `dismissed-${suffix}.test`;
		await db.domainReview.deleteMany({ where: { domain } });

		await directory.companyForEmail(`gm@${domain}`);
		await db.domainReview.updateMany({
			where: { domain },
			data: { status: DomainReviewStatus.DISMISSED },
		});

		await directory.companyForEmail(`revenue@${domain}`);

		const rows = await db.domainReview.findMany({
			where: { domain },
			select: { status: true },
		});

		expect(rows).toHaveLength(1);
		expect(rows[0]?.status).toBe(DomainReviewStatus.DISMISSED);
		await db.domainReview.deleteMany({ where: { domain } });
	});

	it("names the ambiguity when several businesses share the domain", async () => {
		const match = await directory.companyForDomain(SHARED_DOMAIN);

		expect(match.companyId).toBeNull();
		expect(match.reason).toBe(DomainReviewReason.AMBIGUOUS);
	});
});

describe("the travel field definitions", () => {
	it("exist in any database the migrations built, not only a seeded one", async () => {
		const definitions = await db.fieldDefinition.findMany({
			where: { entity: "COMPANY", archivedAt: null },
			select: { key: true, showOnFilter: true },
			orderBy: { position: "asc" },
		});

		expect(definitions.map((row) => row.key)).toEqual([
			"lifecycle_stage",
			"region",
			"chain_scale",
			"distribution_model",
			"priority",
			"lead_source",
			"relationship_owner",
		]);

		const lifecycle = definitions.find((row) => row.key === "lifecycle_stage");
		const region = definitions.find((row) => row.key === "region");

		expect(lifecycle?.showOnFilter).toBe(true);
		expect(region?.showOnFilter).toBe(true);
	});

	it("carries the lifecycle stages the coverage view depends on", async () => {
		const options = await db.fieldOption.findMany({
			where: { field: { entity: "COMPANY", key: "lifecycle_stage" } },
			select: { label: true },
			orderBy: { position: "asc" },
		});

		expect(options.map((row) => row.label)).toEqual([
			"Target",
			"Contacted",
			"Engaged",
			"Opportunity",
			"Customer",
			"Dormant",
			"Not a fit",
		]);
	});

	it("has retired the inherited SaaS fields", async () => {
		const retired = await db.fieldDefinition.findMany({
			where: {
				entity: "COMPANY",
				key: {
					in: [
						"account_type",
						"segment",
						"territory",
						"icp_fit_score",
						"bdr_owner",
					],
				},
			},
			select: { key: true, archivedAt: true },
		});

		for (const row of retired) {
			expect(row.archivedAt).not.toBeNull();
		}
	});
});

describe("a contact moved by a writer that never calls a service", () => {
	it("still gets its employer assignment moved, because the rule is in the database", async () => {
		await db.contact.update({
			where: { id: ids.director },
			data: { companyId: ids.sofitelSydney },
		});

		const current = await db.contactAssignment.findMany({
			where: {
				contactId: ids.director,
				scope: AssignmentScope.EMPLOYER,
				validTo: null,
			},
			select: { companyId: true, isPrimary: true },
		});

		expect(current).toHaveLength(1);
		expect(current[0]?.companyId).toBe(ids.sofitelSydney);
		expect(current[0]?.isPrimary).toBe(true);

		await db.contact.update({
			where: { id: ids.director },
			data: { companyId: ids.group },
		});
	});
});

describe("a group opportunity that covers many properties", () => {
	it("keeps one counterparty and lists every property it unlocks", async () => {
		const owner = await db.user.upsert({
			where: { email: `owner-${suffix}@example.test` },
			create: {
				id: `user-${suffix}`,
				name: "Test Rep",
				email: `owner-${suffix}@example.test`,
			},
			update: {},
			select: { id: true },
		});

		const deal = await db.deal.create({
			data: {
				name: `Accor master agreement ${suffix}`,
				companyId: ids.group,
				ownerId: owner.id,
				covers: {
					create: [
						{ companyId: ids.sofitelSydney },
						{ companyId: ids.sofitelMelbourne },
						{ companyId: ids.novotelBrisbane },
					],
				},
			},
			select: { id: true, companyId: true },
		});

		const covered = await db.opportunityEntity.findMany({
			where: { dealId: deal.id },
			select: { companyId: true },
		});

		expect(deal.companyId).toBe(ids.group);
		expect(new Set(covered.map((row) => row.companyId))).toEqual(
			new Set([ids.sofitelSydney, ids.sofitelMelbourne, ids.novotelBrisbane]),
		);

		await db.deal.delete({ where: { id: deal.id } });
	});
});
