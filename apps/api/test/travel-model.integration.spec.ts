import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	ContactRoleType,
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RelationshipType,
} from "@crm/db";
import { ContactAssignmentService } from "../src/contacts/contact-assignment.service";

const suffix = process.env.TEST_RUN_ID ?? "travel-model";
const SHARED_DOMAIN = `accor-${suffix}.test`;
const OWN_DOMAIN = `novotel-brisbane-${suffix}.test`;

const assignments = new ContactAssignmentService(db);

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

async function company(
	name: string,
	entityType: EntityType,
	domain: string | null,
): Promise<string> {
	const row = await db.company.create({
		data: { name, entityType, domain, verticalId: hotelVerticalId },
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
