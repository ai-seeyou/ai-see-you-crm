import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import {
	businessDimensionFilter,
	navigationFacets,
} from "../src/companies/commercial-navigation";
import { CompanyDirectoryService } from "../src/companies/company-directory.service";
import { contactListInput } from "../src/contacts/contacts.contracts";
import { ContactsService } from "../src/contacts/contacts.service";
import { coverageInput } from "../src/coverage/coverage.contracts";
import { CoverageService } from "../src/coverage/coverage.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { FieldsService } from "../src/fields/fields.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const tag = `CATEGORY-QA-${crypto.randomUUID()}`;
const current = `${tag}-current`;
const historical = `${tag}-historical`;
const ids: string[] = [];
const categories = [
	"RE-0001",
	"RE-0002",
	"RE-0003",
	"RE-0004",
	"RE-0005",
	"RE-0006",
	"RE-0007",
	"RE-0008",
	"RE-0010",
];
let previous: {
	id: string;
	snapshotId: string | null;
	revision: number;
} | null;
let sydney: string;
let london: string;
let oldOnly: string;
let archived: string;
let stale: string;
let unknown: string;
let group: string;
const agent = {
	withCrmEvents: withDiscardedCrmEvents,
} as unknown as AgentTriggerService;
const contacts = new ContactsService(
	db,
	new CompanyDirectoryService(db),
	agent,
	new AgentQueueService(db),
	new ActivityStampService(db),
	new FieldsService(db, agent),
);
const coverage = new CoverageService(db);

async function hotel(
	name: string,
	country: string,
	destination: string,
	confirmed = true,
) {
	const company = await db.company.create({
		data: { name: `${tag} ${name}`, countryCode: country, entityType: "HOTEL" },
	});
	ids.push(company.id);
	await db.productionBusinessProfile.create({
		data: {
			companyId: company.id,
			productionPropertyId: company.id,
			ownershipStatus: "unresolved",
			destinationProductionId: destination,
			destinationName: destination,
			destinationSlug: destination,
			destinationType: "city",
			commercialKnowledge: {},
			sourceUpdatedAt: new Date(),
			fetchedAt: new Date(),
		},
	});
	await db.externalRef.create({
		data: {
			recordType: "COMPANY",
			recordId: company.id,
			system: "PRODUCTION",
			externalId: company.id,
			matchMethod: "production-property-id",
			matchedBy: "IMPORT",
			confirmedAt: confirmed ? new Date() : null,
		},
	});
	return company.id;
}

async function contact(
	name: string,
	assignments: {
		companyId: string;
		scope?: "EMPLOYER" | "RESPONSIBLE_FOR";
		validFrom?: Date;
		validTo?: Date;
	}[],
) {
	await db.contact.create({
		data: {
			firstName: tag,
			lastName: name,
			email: `${tag}-${name}@test.invalid`,
			assignments: {
				create: assignments.map(({ scope, ...assignment }) => ({
					...assignment,
					scope: scope ?? "RESPONSIBLE_FOR",
					roleType: "COMMERCIAL",
				})),
			},
		},
	});
}

beforeAll(async () => {
	previous = await db.productionCategoryState.findUnique({
		where: { id: "core" },
	});
	sydney = await hotel("Sydney", "AU", `${tag}-sydney`);
	london = await hotel("London", "GB", `${tag}-london`);
	oldOnly = await hotel("Historical", "AU", `${tag}-sydney`);
	archived = await hotel("Archived", "AU", `${tag}-sydney`);
	stale = await hotel("Stale", "AU", `${tag}-sydney`);
	unknown = await hotel("Unconfirmed", "AU", `${tag}-sydney`, false);
	await db.company.update({
		where: { id: archived },
		data: { archivedAt: new Date() },
	});
	await db.externalRef.updateMany({
		where: { recordId: stale },
		data: { staleAt: new Date() },
	});
	group = (
		await db.company.create({
			data: { name: `${tag} Group`, entityType: "HOTEL_GROUP" },
		})
	).id;
	ids.push(group);
	await db.externalRef.create({
		data: {
			recordType: "COMPANY",
			recordId: group,
			system: "PRODUCTION",
			externalId: group,
			confirmedAt: new Date(),
			matchMethod: "production-chain-id",
			matchedBy: "IMPORT",
		},
	});
	const edge = await db.entityRelationship.create({
		data: { fromCompanyId: sydney, toCompanyId: group, type: "BELONGS_TO" },
	});
	await db.externalRelationshipRef.create({
		data: {
			relationshipId: edge.id,
			system: "PRODUCTION",
			externalId: edge.id,
			confirmedAt: new Date(),
			sourceUpdatedAt: new Date(),
		},
	});
	for (const id of [current, historical])
		await db.productionCategorySnapshot.create({
			data: {
				id,
				manifest: {},
				membershipDigest: "0".repeat(64),
				propertyCount: 6,
				membershipCount: 6,
				linkedPropertyCount: 6,
				unresolvedPropertyCount: 0,
				categories: {
					create: [
						...categories,
						...(id === historical ? ["RE-0009"] : []),
					].map((categoryId) => ({ categoryId, name: categoryId })),
				},
			},
		});
	await db.productionCategoryMembership.createMany({
		data: [
			...[sydney, archived, stale, unknown].map((companyId) => ({
				snapshotId: current,
				productionPropertyId: companyId,
				companyId,
				categoryId: "RE-0001",
			})),
			{
				snapshotId: current,
				productionPropertyId: london,
				companyId: london,
				categoryId: "RE-0002",
			},
			{
				snapshotId: historical,
				productionPropertyId: oldOnly,
				companyId: oldOnly,
				categoryId: "RE-0001",
			},
			{
				snapshotId: current,
				productionPropertyId: `${tag}-unresolved`,
				companyId: null,
				categoryId: "RE-0001",
			},
		],
	});
	await db.productionCategoryState.upsert({
		where: { id: "core" },
		create: { id: "core", snapshotId: current },
		update: { snapshotId: current },
	});
	await contact("Explicit", [
		{ companyId: group, scope: "EMPLOYER" },
		{ companyId: sydney },
		{ companyId: london },
	]);
	await contact("EmployerOnly", [{ companyId: group, scope: "EMPLOYER" }]);
	await contact("Crossed", [{ companyId: sydney }, { companyId: london }]);
	await contact("Future", [
		{ companyId: sydney, validFrom: new Date("2099-01-01T00:00:00Z") },
	]);
	await contact("Ended", [
		{ companyId: sydney, validTo: new Date("2000-01-01T00:00:00Z") },
	]);
	await contact("Archived", [{ companyId: archived }]);
});

afterAll(async () => {
	if (previous)
		await db.productionCategoryState.update({
			where: { id: "core" },
			data: { snapshotId: previous.snapshotId, revision: previous.revision },
		});
	else await db.productionCategoryState.deleteMany({ where: { id: "core" } });
	await db.productionCategorySnapshot.deleteMany({
		where: { id: { in: [current, historical] } },
	});
	await db.contact.deleteMany({ where: { firstName: tag } });
	await db.externalRef.deleteMany({ where: { recordId: { in: ids } } });
	await db.company.deleteMany({ where: { id: { in: ids } } });
});

async function matching(categoryIds: string[], dimensions = {}) {
	const where = await businessDimensionFilter(db, {
		countryCodes: [],
		destinationIds: [],
		hotelGroupIds: [],
		categoryIds,
		...dimensions,
	});
	return db.company.findMany({
		where: { AND: [{ id: { in: ids }, archivedAt: null }, where] },
		select: { id: true },
	});
}

describe("independent core Category navigation", () => {
	it("does not transfer membership through a changed Production identity", async () => {
		const replacement = `${tag}-replacement`;
		try {
			await db.externalRef.updateMany({
				where: { recordId: sydney },
				data: { externalId: replacement },
			});
			await db.productionBusinessProfile.update({
				where: { companyId: sydney },
				data: { productionPropertyId: replacement },
			});
			expect(await matching(["RE-0001"])).toEqual([]);
			expect(
				(await navigationFacets(db)).categories.find((x) => x.id === "RE-0001")
					?.count,
			).toBe(0);
		} finally {
			await db.externalRef.updateMany({
				where: { recordId: sydney },
				data: { externalId: sydney },
			});
			await db.productionBusinessProfile.update({
				where: { companyId: sydney },
				data: { productionPropertyId: sydney },
			});
		}
	});
	it("uses only active memberships and confirmed current property references", async () => {
		expect(await matching(["RE-0001"])).toEqual([{ id: sydney }]);
		expect(await matching(["unknown"])).toEqual([]);
		expect(await matching(["RE-0009"])).toEqual([]);
	});
	it("uses OR within Category and AND across the same business dimensions", async () => {
		expect(
			new Set((await matching(["RE-0001", "RE-0002"])).map((x) => x.id)),
		).toEqual(new Set([sydney, london]));
		expect(await matching(["RE-0001"], { countryCodes: ["GB"] })).toEqual([]);
		expect(
			await matching(["RE-0001"], {
				countryCodes: ["AU"],
				destinationIds: [`${tag}-sydney`],
				hotelGroupIds: [group],
			}),
		).toEqual([{ id: sydney }]);
	});
	it("offers nine current Categories including zero counts without retired history", async () => {
		const facets = (await navigationFacets(db)).categories;
		expect(new Set(facets.map((x) => x.id))).toEqual(new Set(categories));
		expect(facets.find((x) => x.id === "RE-0001")?.count).toBe(1);
		expect(facets.find((x) => x.id === "RE-0003")?.count).toBe(0);
	});
	it("retains Category matching for caller-controlled archived views", async () => {
		const where = await businessDimensionFilter(db, {
			countryCodes: [],
			destinationIds: [],
			hotelGroupIds: [],
			categoryIds: ["RE-0001"],
		});
		expect(
			await db.company.findMany({
				where: { AND: [{ id: { in: ids }, archivedAt: { not: null } }, where] },
				select: { id: true },
			}),
		).toEqual([{ id: archived }]);
	});
	it("applies Category-only Contacts through active explicit assignments", async () => {
		const result = await contacts.list(
			contactListInput.parse({ q: tag, categoryIds: ["RE-0001"] }),
		);
		expect(new Set(result.rows.map((x) => x.lastName))).toEqual(
			new Set(["Explicit", "Crossed"]),
		);
	});
	it("rejects cross-business Contacts and supports explicit group-level responsibility", async () => {
		const crossed = await contacts.list(
			contactListInput.parse({
				q: tag,
				categoryIds: ["RE-0002"],
				countryCodes: ["AU"],
			}),
		);
		expect(crossed.rows).toHaveLength(0);
		const matched = await contacts.list(
			contactListInput.parse({
				q: tag,
				categoryIds: ["RE-0001"],
				destinationIds: [`${tag}-sydney`],
				hotelGroupIds: [group],
			}),
		);
		expect(new Set(matched.rows.map((x) => x.lastName))).toEqual(
			new Set(["Explicit", "Crossed"]),
		);
	});
	it("evaluates missing commercial coverage on the same Category-filtered business", async () => {
		const result = await coverage.gaps(
			coverageInput.parse({
				scope: "ALL_HOTELS",
				categoryIds: ["RE-0001"],
				countryCodes: ["AU"],
				destinationIds: [`${tag}-sydney`],
				hotelGroupIds: [group],
				missingRoleTypes: ["COMMERCIAL"],
			}),
		);
		expect(result.examined).toBe(1);
		expect(result.total).toBe(0);
	});
	it("includes multi-destination responsibility in each matching Category", async () => {
		const result = await contacts.list(
			contactListInput.parse({
				q: tag,
				categoryIds: ["RE-0002"],
				destinationIds: [`${tag}-london`],
			}),
		);
		expect(new Set(result.rows.map((x) => x.lastName))).toEqual(
			new Set(["Explicit", "Crossed"]),
		);
	});
	it("shows a missing role after responsible assignments end", async () => {
		const assignments = await db.contactAssignment.findMany({
			where: { companyId: sydney, validTo: null, validFrom: null },
			select: { id: true },
		});
		try {
			await db.contactAssignment.updateMany({
				where: { id: { in: assignments.map((x) => x.id) } },
				data: { validTo: new Date("2000-01-01T00:00:00Z") },
			});
			const result = await coverage.gaps(
				coverageInput.parse({
					scope: "ALL_HOTELS",
					categoryIds: ["RE-0001"],
					countryCodes: ["AU"],
					destinationIds: [`${tag}-sydney`],
					hotelGroupIds: [group],
					missingRoleTypes: ["COMMERCIAL"],
				}),
			);
			expect(result.rows.map((x) => x.id)).toEqual([sydney]);
			expect(result.total).toBe(1);
		} finally {
			await db.contactAssignment.updateMany({
				where: { id: { in: assignments.map((x) => x.id) } },
				data: { validTo: null },
			});
		}
	});
});
