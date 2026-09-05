import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	ContactRoleType,
	db,
	EntityType,
	FactBand,
	FactStatus,
	RelationshipType,
} from "@crm/db";
import { readCompanyHistory } from "../agent/lib/accounts";
import { readCrmHistory } from "../agent/lib/crm";
import {
	coverageMarkdown,
	employerMoveBlock,
	readBusinessStructure,
	readContactCoverage,
	structureMarkdown,
} from "../agent/lib/entities";
import { ENTITY } from "../agent/lib/entity-config";
import { searchCrm } from "../agent/lib/lookup";
import { recordJobChange } from "../agent/tools/record_job_change";

const suffix = process.env.TEST_RUN_ID ?? "entities-spec";
const tag = `Travelspec${suffix.replace(/[^A-Za-z0-9]/g, "")}`;
const domain = `sofitel-${suffix}.test`;
const groupDomain = `accor-${suffix}.test`;

const EXTRA_PROPERTIES = ENTITY.relationships.contains + 1;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

let verticalId: string;
let groupId: string;
let managerId: string;
let brandId: string;
let formerManagerId: string;
let futureManagerId: string;
let propertyId: string;
let standaloneId: string;
let directorId: string;
let formerDirectorId: string;
let futureDirectorId: string;
let moverId: string;
let userId: string;

async function business(
	name: string,
	entityType: EntityType,
	extra: { domain?: string; verticalId?: string } = {},
): Promise<string> {
	const row = await db.company.create({
		data: {
			name: `${tag} ${name}`,
			domain: extra.domain,
			verticalId: extra.verticalId,
			entityType,
		},
		select: { id: true },
	});

	return row.id;
}

beforeAll(async () => {
	await cleanup();

	const user = await db.user.create({
		data: {
			id: `entity-user-${suffix}`,
			name: "Entity Test Rep",
			email: `entity.rep.${suffix}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});
	userId = user.id;

	const vertical = await db.vertical.create({
		data: { key: `hotel-${suffix}`, label: "Hotels", position: 900 },
		select: { id: true },
	});
	verticalId = vertical.id;

	groupId = await business("Accor Hotel Group", EntityType.HOTEL_GROUP, {
		domain: groupDomain,
		verticalId,
	});
	managerId = await business(
		"Accor Management APAC",
		EntityType.MANAGEMENT_COMPANY,
		{ verticalId },
	);
	brandId = await business("Sofitel", EntityType.HOTEL_BRAND, { verticalId });
	formerManagerId = await business(
		"Mantra Group",
		EntityType.MANAGEMENT_COMPANY,
	);
	futureManagerId = await business(
		"Future Management Company",
		EntityType.MANAGEMENT_COMPANY,
	);
	propertyId = await business(
		"Sofitel Sydney Darling Harbour",
		EntityType.HOTEL,
		{ domain, verticalId },
	);
	standaloneId = await business("Fernhill Lodge", EntityType.OTHER);

	await db.entityRelationship.createMany({
		data: [
			{
				fromCompanyId: propertyId,
				toCompanyId: groupId,
				type: RelationshipType.BELONGS_TO,
				validFrom: daysAgo(900),
			},
			{
				fromCompanyId: propertyId,
				toCompanyId: managerId,
				type: RelationshipType.MANAGED_BY,
				validFrom: daysAgo(400),
			},
			{
				fromCompanyId: propertyId,
				toCompanyId: brandId,
				type: RelationshipType.BRAND_OF,
			},
			{
				fromCompanyId: propertyId,
				toCompanyId: formerManagerId,
				type: RelationshipType.MANAGED_BY,
				validFrom: daysAgo(2000),
				validTo: daysAgo(401),
			},
			{
				fromCompanyId: propertyId,
				toCompanyId: futureManagerId,
				type: RelationshipType.MANAGED_BY,
				validFrom: daysAgo(-30),
			},
		],
	});

	for (let index = 0; index < EXTRA_PROPERTIES; index += 1) {
		const siblingId = await business(
			`Novotel Property ${String(index).padStart(2, "0")}`,
			EntityType.HOTEL,
		);
		await db.entityRelationship.create({
			data: {
				fromCompanyId: siblingId,
				toCompanyId: groupId,
				type: RelationshipType.BELONGS_TO,
			},
		});
	}

	const director = await db.contact.create({
		data: {
			firstName: "Marie",
			lastName: `Dubois ${tag}`,
			email: `marie.dubois@${groupDomain}`,
			title: "Group Director of Distribution",
			companyId: managerId,
		},
		select: { id: true },
	});
	directorId = director.id;

	const formerDirector = await db.contact.create({
		data: {
			firstName: "Ines",
			lastName: `Rocha ${tag}`,
			email: `ines.rocha@${groupDomain}`,
			title: "Former Director of Distribution",
			companyId: formerManagerId,
		},
		select: { id: true },
	});
	formerDirectorId = formerDirector.id;
	const futureDirector = await db.contact.create({
		data: {
			firstName: "Future",
			lastName: `Director ${tag}`,
			email: `future.director@${groupDomain}`,
			companyId: futureManagerId,
		},
		select: { id: true },
	});
	futureDirectorId = futureDirector.id;

	const mover = await db.contact.create({
		data: {
			firstName: "Tom",
			lastName: `Reid ${tag}`,
			email: `tom.reid@${domain}`,
			title: "General Manager",
			companyId: propertyId,
			ownerId: userId,
		},
		select: { id: true },
	});
	moverId = mover.id;

	await db.contactAssignment.createMany({
		data: [
			{
				contactId: directorId,
				companyId: propertyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.DISTRIBUTION,
				title: "Group Director of Distribution, APAC",
				validFrom: daysAgo(300),
			},
			{
				contactId: formerDirectorId,
				companyId: propertyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.DISTRIBUTION,
				validFrom: daysAgo(2000),
				validTo: daysAgo(500),
			},
			{
				contactId: futureDirectorId,
				companyId: propertyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.DISTRIBUTION,
				validFrom: daysAgo(-30),
			},
		],
	});
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	await db.contact.deleteMany({ where: { lastName: { contains: tag } } });
	await db.company.deleteMany({ where: { name: { startsWith: tag } } });
	await db.vertical.deleteMany({ where: { key: `hotel-${suffix}` } });
	await db.user.deleteMany({ where: { id: `entity-user-${suffix}` } });
}

describe("a property reads as a property", () => {
	it("carries its entity type, its vertical and what it is part of", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(structure.entityType).toBe(EntityType.HOTEL);
		expect(structure.entityTypeLabel).toBe("hotel");
		expect(structure.vertical?.label).toBe("Hotels");
		expect(structure.recorded).toBe(true);

		const byType = new Map(
			structure.partOf.listed.map((link) => [link.type, link.company]),
		);
		expect(byType.get(RelationshipType.BELONGS_TO)?.id).toBe(groupId);
		expect(byType.get(RelationshipType.MANAGED_BY)?.id).toBe(managerId);
		expect(byType.get(RelationshipType.BRAND_OF)?.id).toBe(brandId);
	});

	it("leaves out a relationship that has ended", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(structure.partOf.total).toBe(3);
		expect(structure.partOf.listed).toHaveLength(3);
		expect(
			structure.partOf.listed.map((link) => link.company.id),
		).not.toContain(formerManagerId);

		const markdown = structureMarkdown("Sofitel Sydney", structure);
		expect(markdown).not.toContain("Mantra Group");
		expect(markdown).toContain("Only current records are listed here.");
	});

	it("leaves out a relationship that has not started", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(
			structure.partOf.listed.map((link) => link.company.id),
		).not.toContain(futureManagerId);
	});

	it("names the group and the manager in the text the model reads", async () => {
		const markdown = structureMarkdown(
			"Sofitel Sydney",
			await readBusinessStructure(propertyId),
		);

		expect(markdown).toContain("Kind of business: **hotel**");
		expect(markdown).toContain(`recorded as belonging to **${tag} Accor Hotel`);
		expect(markdown).toContain(`recorded as managed by **${tag} Accor Manage`);
	});
});

describe("people responsible from another payroll", () => {
	it("shows a group contact on the property, with their real employer", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(structure.responsible.total).toBe(1);

		const person = structure.responsible.listed[0];
		expect(person?.id).toBe(directorId);
		expect(person?.employedHere).toBe(false);
		expect(person?.employer?.id).toBe(managerId);
		expect(person?.roleType).toBe(ContactRoleType.DISTRIBUTION);
		expect(person?.title).toBe("Group Director of Distribution, APAC");
	});

	it("leaves out an assignment that has ended", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(
			structure.responsible.listed.map((person) => person.id),
		).not.toContain(formerDirectorId);
	});

	it("leaves out an assignment that has not started", async () => {
		const structure = await readBusinessStructure(propertyId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(
			structure.responsible.listed.map((person) => person.id),
		).not.toContain(futureDirectorId);
	});

	it("shows the property on the contact, and warns against moving them", async () => {
		const coverage = await readContactCoverage(directorId);
		if (!coverage.readable) throw new Error("coverage unreadable");

		expect(coverage.employer?.companyId).toBe(managerId);
		expect(coverage.responsibleFor.total).toBe(1);
		expect(coverage.responsibleFor.listed[0]?.id).toBe(propertyId);

		const markdown = coverageMarkdown("Marie Dubois", coverage);
		expect(markdown).toContain("responsible for **1** business");
		expect(markdown).toContain("recorded against that business");
	});
});

describe("the payload is capped and says the true total", () => {
	it("reports every business under the group, and lists only the cap", async () => {
		const structure = await readBusinessStructure(groupId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(structure.contains.total).toBe(EXTRA_PROPERTIES + 1);
		expect(structure.contains.listed).toHaveLength(
			ENTITY.relationships.contains,
		);
		expect(structure.contains.truncated).toBe(true);

		const markdown = structureMarkdown("Accor Hotel Group", structure);
		expect(markdown).toContain(
			`**${EXTRA_PROPERTIES + 1}** business(es) sit under`,
		);
		expect(markdown).toContain(
			`…and ${EXTRA_PROPERTIES + 1 - ENTITY.relationships.contains} more`,
		);
	});
});

describe("a blank structure is a gap, not independence", () => {
	it("refuses to read an unrecorded business as standalone", async () => {
		const structure = await readBusinessStructure(standaloneId);
		if (!structure.readable) throw new Error("structure unreadable");

		expect(structure.recorded).toBe(false);
		expect(structure.note).toContain(
			"not evidence that the business is independent",
		);
		expect(structure.note).toContain("Say what we do not know");
	});

	it("says it could not read a business that is not there", async () => {
		const structure = await readBusinessStructure("no-such-business");

		expect(structure.readable).toBe(false);
		if (structure.readable) return;
		expect(structure.reason).toContain("no such business");
	});
});

describe("the reads the agent actually calls", () => {
	it("hands the structure back with the company history", async () => {
		const history = await readCompanyHistory(propertyId, {
			includeEmail: false,
			includeCalendar: false,
		});

		expect(history?.structure.readable).toBe(true);
		if (!history?.structure.readable) return;
		expect(
			history.structure.partOf.listed.map((link) => link.company.id),
		).toContain(groupId);
	});

	it("hands a contact's coverage and their employer's structure back", async () => {
		const history = await readCrmHistory(directorId, {
			includeEmail: false,
			includeCalendar: false,
		});

		expect(history?.coverage.readable).toBe(true);
		if (!history?.coverage.readable) return;
		expect(history.coverage.responsibleFor.listed[0]?.id).toBe(propertyId);

		expect(history.employerStructure?.readable).toBe(true);
		if (!history.employerStructure?.readable) return;
		expect(history.employerStructure.entityType).toBe(
			EntityType.MANAGEMENT_COMPANY,
		);
	});

	it("gives a search hit its entity type and what it is part of", async () => {
		const result = await searchCrm(`${tag} Sofitel Sydney Darling Harbour`, {
			kinds: ["company"],
		});

		const hit = result.companies.find((row) => row.id === propertyId);
		expect(hit?.entityType).toBe(EntityType.HOTEL);
		expect(hit?.entityTypeLabel).toBe("hotel");
		expect(hit?.vertical).toBe("Hotels");
		expect(hit?.partOf.map((link) => link.id)).toContain(groupId);
	});
});

describe("the agent cannot invent structure", () => {
	it("refuses an employer move between two related businesses", async () => {
		const blocked = await employerMoveBlock(propertyId, groupId);

		expect(blocked).toContain("The move was not made");
		expect(blocked).toContain("a commercial fact a person confirms");
		expect(blocked).toContain("A property is not its group");
	});

	it("never claims a blocked employer move completed", async () => {
		await db.contactFact.createMany({
			data: [
				{
					contactId: moverId,
					field: "employer",
					value: "Sofitel Sydney Darling Harbour",
					score: 1,
					band: FactBand.VERIFIED,
					evidence: [],
					method: "test",
					status: FactStatus.SUPERSEDED,
					supersededAt: daysAgo(1),
				},
				{
					contactId: moverId,
					field: "employer",
					value: "Accor Hotel Group",
					score: 1,
					band: FactBand.VERIFIED,
					evidence: [],
					method: "test",
					status: FactStatus.APPLIED,
				},
			],
		});

		const result = await recordJobChange({
			contactId: moverId,
			moveToCompanyId: groupId,
		});
		const activity = await db.activity.findFirstOrThrow({
			where: { contactId: moverId },
			orderBy: { createdAt: "desc" },
			select: { subject: true, body: true, meta: true },
		});

		expect(result.moved).toBe(false);
		expect(activity.subject).toContain("reported a possible employer change");
		expect(activity.subject).not.toContain("has moved");
		expect(activity.body).toContain("The move was not made");
		expect(activity.meta).toMatchObject({ blocked: expect.any(String) });
		expect(
			await db.contact.findUnique({
				where: { id: moverId },
				select: { companyId: true },
			}),
		).toEqual({ companyId: propertyId });
	});

	it("refuses it in the other direction too", async () => {
		expect(await employerMoveBlock(groupId, propertyId)).not.toBeNull();
	});

	it("allows a move to a business nothing relates it to", async () => {
		expect(await employerMoveBlock(propertyId, standaloneId)).toBeNull();
		expect(await employerMoveBlock(propertyId, futureManagerId)).toBeNull();
		expect(await employerMoveBlock(null, standaloneId)).toBeNull();
		expect(await employerMoveBlock(propertyId, propertyId)).toBeNull();
	});

	it("makes an employer move an EMPLOYER row and nothing else", async () => {
		await db.contact.update({
			where: { id: moverId },
			data: { companyId: standaloneId },
		});

		const current = await db.contactAssignment.findMany({
			where: { contactId: moverId, validTo: null },
			select: { companyId: true, scope: true, isPrimary: true },
		});

		expect(current).toEqual([
			{
				companyId: standaloneId,
				scope: AssignmentScope.EMPLOYER,
				isPrimary: true,
			},
		]);

		const responsible = await db.contactAssignment.count({
			where: { contactId: moverId, scope: AssignmentScope.RESPONSIBLE_FOR },
		});
		expect(responsible).toBe(0);

		const invented = await db.entityRelationship.count({
			where: {
				OR: [
					{ fromCompanyId: standaloneId },
					{ toCompanyId: standaloneId },
					{ fromCompanyId: propertyId, toCompanyId: standaloneId },
				],
			},
		});
		expect(invented).toBe(0);
	});
});
