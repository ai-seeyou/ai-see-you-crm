import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	AssignmentScope,
	ContactRoleType,
	db,
	EntityType,
	ExternalRecordType,
	ExternalSystem,
	MatchActor,
	RecordSource,
	RelationshipType,
} from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import {
	businessDimensionFilter,
	navigationFacets,
	UNGROUPED_HOTELS,
} from "../src/companies/commercial-navigation";
import { CompaniesService } from "../src/companies/companies.service";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { ContactsService } from "../src/contacts/contacts.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const tag = `NAV${process.env.TEST_RUN_ID ?? "integration"}`;
const ids: string[] = [];
let parentId: string;
let childId: string;
let sydneyId: string;
let aucklandId: string;
let ungroupedId: string;
let archivedId: string;

const agent = {
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;
const fields = new FieldsService(db, agent);
const contacts = new ContactsService(
	db,
	new CompanyDirectoryService(db),
	agent,
	new AgentQueueService(db),
	new ActivityStampService(db),
	fields,
);
const companies = new CompaniesService(
	db,
	agent,
	new AgentQueueService(db),
	{ backfill: async () => undefined } as unknown as FaviconService,
	new ActivityStampService(db),
	new ConversionService(db),
	fields,
);

async function company(
	name: string,
	entityType: EntityType,
	countryCode?: string,
) {
	const row = await db.company.create({
		data: { name: `${tag} ${name}`, entityType, countryCode },
		select: { id: true },
	});
	ids.push(row.id);
	return row.id;
}

async function ref(recordId: string, externalId: string, method: string) {
	await db.externalRef.create({
		data: {
			recordType: ExternalRecordType.COMPANY,
			recordId,
			system: ExternalSystem.PRODUCTION,
			externalId: `${tag}-${externalId}`,
			matchMethod: method,
			matchedBy: MatchActor.IMPORT,
			confirmedAt: new Date(),
		},
	});
}

async function profile(
	companyId: string,
	propertyId: string,
	destinationId: string,
	destinationName: string,
) {
	await db.productionBusinessProfile.create({
		data: {
			companyId,
			productionPropertyId: `${tag}-${propertyId}`,
			ownershipStatus: "chained",
			destinationProductionId: destinationId,
			destinationName,
			destinationSlug: destinationName.toLowerCase(),
			destinationType: "city",
			commercialKnowledge: {},
			sourceUpdatedAt: new Date(),
			fetchedAt: new Date(),
		},
	});
}

async function relationship(
	fromCompanyId: string,
	toCompanyId: string,
	externalId: string,
	staleAt: Date | null = null,
) {
	const row = await db.entityRelationship.create({
		data: {
			fromCompanyId,
			toCompanyId,
			type: RelationshipType.BELONGS_TO,
			source: RecordSource.IMPORT,
		},
		select: { id: true },
	});
	await db.externalRelationshipRef.create({
		data: {
			relationshipId: row.id,
			system: ExternalSystem.PRODUCTION,
			externalId: `${tag}-${externalId}`,
			confirmedAt: new Date(),
			staleAt,
			sourceUpdatedAt: new Date(),
		},
	});
}

beforeAll(async () => {
	parentId = await company("Parent", EntityType.HOTEL_GROUP);
	childId = await company("Child", EntityType.HOTEL_GROUP);
	sydneyId = await company("Sydney", EntityType.HOTEL, "AU");
	aucklandId = await company("Auckland", EntityType.HOTEL, "NZ");
	ungroupedId = await company("Ungrouped", EntityType.HOTEL, "GB");
	const invalidGroupId = await company("Invalid group", EntityType.OTHER);
	archivedId = await company("Archived Sydney", EntityType.HOTEL, "AU");
	await Promise.all([
		ref(parentId, "parent", "production-chain-id"),
		ref(childId, "child", "production-chain-id"),
		ref(sydneyId, "sydney", "production-property-id"),
		ref(aucklandId, "auckland", "production-property-id"),
		ref(ungroupedId, "ungrouped", "production-property-id"),
		ref(archivedId, "archived", "production-property-id"),
		profile(sydneyId, "sydney", "destination-sydney", "Sydney"),
		profile(aucklandId, "auckland", "destination-auckland", "Auckland"),
		profile(ungroupedId, "ungrouped", "destination-london", "London"),
		profile(archivedId, "archived", "destination-sydney", "Sydney"),
	]);
	await relationship(childId, parentId, "child-parent");
	await relationship(sydneyId, childId, "sydney-child");
	await relationship(aucklandId, childId, "auckland-child", new Date());
	await relationship(aucklandId, invalidGroupId, "auckland-invalid-group");
	await relationship(archivedId, childId, "archived-child");
	await db.company.update({
		where: { id: archivedId },
		data: { archivedAt: new Date() },
	});
	const matching = await db.contact.create({
		data: {
			firstName: tag,
			lastName: "Matching",
			email: `${tag}-matching@test.invalid`,
		},
	});
	const cross = await db.contact.create({
		data: {
			firstName: tag,
			lastName: "Cross",
			email: `${tag}-cross@test.invalid`,
		},
	});
	await db.contactAssignment.createMany({
		data: [
			{
				contactId: matching.id,
				companyId: sydneyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.COMMERCIAL,
			},
			{
				contactId: cross.id,
				companyId: ungroupedId,
				scope: AssignmentScope.EMPLOYER,
				roleType: ContactRoleType.COMMERCIAL,
			},
			{
				contactId: cross.id,
				companyId: sydneyId,
				scope: AssignmentScope.RESPONSIBLE_FOR,
				roleType: ContactRoleType.COMMERCIAL,
			},
		],
	});
});

afterAll(async () => {
	await db.contact.deleteMany({ where: { firstName: tag } });
	await db.externalRef.deleteMany({ where: { recordId: { in: ids } } });
	await db.company.deleteMany({ where: { id: { in: ids } } });
});

describe("commercial navigation", () => {
	it("combines dimensions and follows a governed parent chain", async () => {
		const where = await businessDimensionFilter(db, {
			countryCodes: ["AU"],
			destinationIds: ["destination-sydney"],
			hotelGroupIds: [parentId],
		});
		const rows = await db.company.findMany({
			where: { AND: [{ archivedAt: null }, where] },
			select: { id: true },
		});
		expect(rows.map(({ id }) => id)).toEqual([sydneyId]);
	});

	it("fails closed for an unknown group and excludes stale edges", async () => {
		const unknown = await businessDimensionFilter(db, {
			countryCodes: [],
			destinationIds: [],
			hotelGroupIds: ["unknown"],
		});
		const parent = await businessDimensionFilter(db, {
			countryCodes: [],
			destinationIds: [],
			hotelGroupIds: [parentId],
		});
		expect(await db.company.count({ where: unknown })).toBe(0);
		expect(
			(
				await db.company.findMany({
					where: { AND: [{ archivedAt: null }, parent] },
					select: { id: true },
				})
			).map(({ id }) => id),
		).toEqual([sydneyId]);
	});

	it("offers ungrouped hotels and uses the United Kingdom label", async () => {
		const where = await businessDimensionFilter(db, {
			countryCodes: [],
			destinationIds: [],
			hotelGroupIds: [UNGROUPED_HOTELS],
		});
		expect(
			(await db.company.findMany({ where, select: { id: true } })).map(
				({ id }) => id,
			),
		).toEqual(expect.arrayContaining([ungroupedId, aucklandId]));
		const facets = await navigationFacets(db);
		expect(facets.countries.find(({ code }) => code === "GB")?.label).toBe(
			"United Kingdom",
		);
		expect(facets.hotelGroups.find(({ id }) => id === parentId)?.count).toBe(1);
		expect(
			facets.hotelGroups.find(({ id }) => id === UNGROUPED_HOTELS)?.count,
		).toBeGreaterThanOrEqual(1);
	});

	it("requires combined contact dimensions on one assigned hotel", async () => {
		const base = {
			q: tag,
			sort: "",
			dir: "asc" as const,
			page: 1,
			pageSize: 25,
			owner: [],
			company: [],
			source: [],
			title: [],
			seniority: [],
			persona: [],
			roleType: [],
			activity: [],
			fields: {},
			archived: false,
		};
		const matched = await contacts.list({
			...base,
			countryCodes: ["AU"],
			destinationIds: ["destination-sydney"],
			hotelGroupIds: [parentId],
		});
		const crossed = await contacts.list({
			...base,
			countryCodes: ["GB"],
			destinationIds: [],
			hotelGroupIds: [parentId],
		});
		expect(new Set(matched.rows.map(({ lastName }) => lastName))).toEqual(
			new Set(["Matching", "Cross"]),
		);
		expect(crossed.rows).toHaveLength(0);
	});

	it("keeps archived destination and group results in archived business views", async () => {
		const base = {
			q: tag,
			sort: "",
			dir: "asc" as const,
			page: 1,
			pageSize: 25,
			owner: [],
			industry: [],
			vertical: [],
			entityType: [],
			enrichment: [],
			source: [],
			activity: [],
			fields: {},
			archived: true,
		};
		const destinationFilter = await businessDimensionFilter(db, {
			countryCodes: [],
			destinationIds: ["destination-sydney"],
			hotelGroupIds: [],
		});
		expect(
			await db.company.findMany({
				where: { AND: [{ archivedAt: { not: null } }, destinationFilter] },
				select: { id: true },
			}),
		).toEqual([{ id: archivedId }]);
		const destination = await companies.list({
			...base,
			countryCodes: [],
			destinationIds: ["destination-sydney"],
			hotelGroupIds: [],
		});
		const group = await companies.list({
			...base,
			countryCodes: [],
			destinationIds: [],
			hotelGroupIds: [parentId],
		});
		expect(destination.rows.map(({ id }) => id)).toEqual([archivedId]);
		expect(group.rows.map(({ id }) => id)).toEqual([archivedId]);
	});
});
